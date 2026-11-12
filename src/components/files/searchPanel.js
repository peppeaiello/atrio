// Search bar of the code editor, in place of CodeMirror's own: a large field that jumps to the first match while
// typing, "2 of 5", previous / next, three clear toggles, and a replace row while editing. Plain DOM, as
// CodeMirror panels are.
import { SearchQuery, closeSearchPanel, findNext, findPrevious, getSearchQuery, replaceAll, replaceNext, setSearchQuery } from '@codemirror/search'
import { EditorSelection } from '@codemirror/state'
import { EditorView, runScopeHandlers } from '@codemirror/view'
import { icons } from './icons.js'

const COUNT_LIMIT = 1000

function svg(name) {
  return `<svg aria-hidden="true" fill="none" height="18" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="18">${icons[name]}</svg>`
}

function element(tag, attributes = {}, children = []) {
  const el = document.createElement(tag)
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'html')
      el.innerHTML = value
    else if (key === 'text')
      el.textContent = value
    else el.setAttribute(key, value)
  })
  children.forEach(child => el.append(child))
  return el
}

// `t(key, values)` translates the file manager's strings.
export function searchPanel(t) {
  return (view) => {
    let query = getSearchQuery(view.state)
    let countFrame = 0

    const findInput = element('input', {
      'class': 'files-find__input',
      'type': 'search',
      'placeholder': t('findPlaceholder'),
      'aria-label': t('findPlaceholder'),
      'main-field': 'true',
      'autocomplete': 'off',
      'autocapitalize': 'off',
      'spellcheck': 'false',
      'enterkeyhint': 'search',
    })
    const replaceInput = element('input', {
      'class': 'files-find__input',
      'type': 'text',
      'placeholder': t('replacePlaceholder'),
      'aria-label': t('replacePlaceholder'),
      'autocomplete': 'off',
      'autocapitalize': 'off',
      'spellcheck': 'false',
    })
    const count = element('span', { 'class': 'files-find__count', 'aria-live': 'polite' })

    const iconButton = (name, label, run) => {
      const button = element('button', { 'class': 'files-find__icon', 'type': 'button', 'title': label, 'aria-label': label, 'html': svg(name) })
      button.addEventListener('click', () => run())
      return button
    }
    const toggle = (text, label, key) => {
      const button = element('button', { 'class': 'files-find__toggle', 'type': 'button', 'title': label, 'aria-label': label, 'text': text })
      button.addEventListener('click', () => commit({ [key]: !query[key] }))
      return button
    }
    const textButton = (label, run) => {
      const button = element('button', { class: 'files-find__button', type: 'button', text: label })
      button.addEventListener('click', () => run())
      return button
    }

    const caseToggle = toggle('Aa', t('matchCase'), 'caseSensitive')
    const regexpToggle = toggle('.*', t('regexp'), 'regexp')
    const wordToggle = toggle('W', t('wholeWord'), 'wholeWord')

    const findRow = element('div', { class: 'files-find__row' }, [
      element('div', { class: 'files-find__field' }, [findInput, count]),
      element('div', { class: 'files-find__group' }, [caseToggle, regexpToggle, wordToggle]),
      element('div', { class: 'files-find__group' }, [
        iconButton('chevronUp', `${t('previousMatch')} (Shift+Enter)`, () => findPrevious(view)),
        iconButton('chevronDown', `${t('nextMatch')} (Enter)`, () => findNext(view)),
        iconButton('x', t('closeSearch'), () => closeSearchPanel(view)),
      ]),
    ])
    const replaceRow = element('div', { class: 'files-find__row' }, [
      element('div', { class: 'files-find__field' }, [replaceInput]),
      element('div', { class: 'files-find__group' }, [
        textButton(t('replaceOne'), () => replaceNext(view)),
        textButton(t('replaceAll'), () => replaceAll(view)),
      ]),
    ])
    const dom = element('div', { class: 'files-find', role: 'search' }, [findRow, replaceRow])

    // Moves the selection to the first match at or after the cursor, while the user types.
    function jumpToFirst() {
      if (!query.valid || !query.search)
        return
      const start = view.state.selection.main.from
      let found = query.getCursor(view.state, start).next()
      if (found.done)
        found = query.getCursor(view.state, 0, start).next()
      if (found.done)
        return
      const { from, to } = found.value
      view.dispatch({
        selection: EditorSelection.single(from, to),
        effects: EditorView.scrollIntoView(from, { y: 'center' }),
        userEvent: 'select.search',
      })
    }

    function commit(changes = {}, jump = false) {
      const next = new SearchQuery({
        search: findInput.value,
        replace: replaceInput.value,
        caseSensitive: query.caseSensitive,
        regexp: query.regexp,
        wholeWord: query.wholeWord,
        ...changes,
      })
      if (next.eq(query))
        return
      query = next
      view.dispatch({ effects: setSearchQuery.of(next) })
      if (jump)
        jumpToFirst()
    }

    function refreshCount() {
      countFrame = 0
      dom.classList.toggle('is-invalid', !!query.search && !query.valid)
      if (!query.search) {
        count.textContent = ''
        return
      }
      if (!query.valid) {
        count.textContent = '—'
        return
      }
      const { from, to } = view.state.selection.main
      const cursor = query.getCursor(view.state)
      let total = 0
      let current = 0
      for (let match = cursor.next(); !match.done; match = cursor.next()) {
        total++
        if (match.value.from === from && match.value.to === to)
          current = total
        if (total >= COUNT_LIMIT)
          break
      }
      const shown = total >= COUNT_LIMIT ? `${COUNT_LIMIT - 1}+` : String(total)
      count.textContent = !total ? t('noResults') : current ? t('matchOf', { i: current, n: shown }) : t('matchTotal', { n: shown })
      dom.classList.toggle('is-empty', !total)
    }

    function scheduleCount() {
      if (!countFrame)
        countFrame = requestAnimationFrame(refreshCount)
    }

    function sync() {
      if (findInput.value !== query.search)
        findInput.value = query.search
      if (replaceInput.value !== query.replace)
        replaceInput.value = query.replace
      caseToggle.setAttribute('aria-pressed', String(query.caseSensitive))
      regexpToggle.setAttribute('aria-pressed', String(query.regexp))
      wordToggle.setAttribute('aria-pressed', String(query.wholeWord))
      replaceRow.hidden = view.state.readOnly
      scheduleCount()
    }

    findInput.addEventListener('input', () => commit({}, true))
    replaceInput.addEventListener('input', () => commit())
    dom.addEventListener('keydown', (e) => {
      // CodeMirror's own search keys: Escape closes, F3 and Ctrl+G move, Ctrl+F refocuses.
      if (runScopeHandlers(view, e, 'search-panel')) {
        e.preventDefault()
        return
      }
      if (e.key === 'Enter' && e.target === findInput) {
        e.preventDefault()
        ;(e.shiftKey ? findPrevious : findNext)(view)
      }
      else if (e.key === 'Enter' && e.target === replaceInput) {
        e.preventDefault()
        ;(e.ctrlKey || e.metaKey ? replaceAll : replaceNext)(view)
      }
    })

    sync()

    return {
      dom,
      top: true,
      mount() {
        findInput.focus()
        findInput.select()
      },
      update(update) {
        const latest = getSearchQuery(update.state)
        if (!latest.eq(query))
          query = latest
        if (update.docChanged || update.selectionSet || update.transactions.some(tr => tr.effects.length) || update.startState.readOnly !== update.state.readOnly)
          sync()
      },
      destroy() {
        if (countFrame)
          cancelAnimationFrame(countFrame)
      },
    }
  }
}
