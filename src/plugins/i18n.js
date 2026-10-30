
import { createI18n } from 'vue-i18n'
import messages from '@/assets/lang'

const i18n = createI18n({
	legacy: true,
	allowComposition: true,
	// Define defalut language
	locale: localStorage.getItem('lang') || 'en_us',
	fallbackLocale: 'en_us',
	silentTranslationWarn: true,
	silentFallbackWarn: true,
	warnHtmlMessage: false,
	messages
})
export default i18n
