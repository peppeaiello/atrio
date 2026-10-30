const files = import.meta.glob('./*.json', { eager: true, import: 'default' })
const langs = {}
Object.keys(files).forEach((key) => {
  langs[key.replace(/(\.\/|\.json$)/g, '').toLowerCase()] = files[key]
})

export default langs
