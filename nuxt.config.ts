// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/fonts'],
  vite: {
    plugins: [tailwindcss()],
  },
  css: ["~/assets/app.css"],
  app: {
    head: {
      title: 'Simpler Worklog',
      htmlAttrs: {
        'data-theme': 'dracula',
      },
      meta: [
        { name: 'robots', content: 'noindex, nofollow' },
      ],
    },
  },
})