// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: true },
  modules: ["@nuxt/eslint", "@nuxt/fonts", "nuxt-icon"],
  vite: {
    plugins: [tailwindcss()],
  },
  css: ["~/assets/app.css"],
  app: {
    head: {
      title: "Workly",
      htmlAttrs: {
        "data-theme": "dracula",
      },
      meta: [{ name: "robots", content: "noindex, nofollow" }],
    },
  },
});
