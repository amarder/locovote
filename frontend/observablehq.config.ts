function pad(number: number, length: number): string {
  return String(number).padStart(length, "0");
}

function formatIsoDate(date: Date): string {
  return `${[pad(date.getFullYear(), 4), pad(date.getMonth() + 1, 2), pad(date.getDate(), 2)].join("-")}T${[
    pad(date.getHours(), 2),
    pad(date.getMinutes(), 2),
    pad(date.getSeconds(), 2)
  ].join(":")}`;
}

function formatLocaleDate(date: Date, locale: Intl.LocalesArgument = "en-US"): string {
  return date.toLocaleDateString(locale, {month: "short", day: "numeric", year: "numeric"});
}

let currentDate: Date | null = null;

function defaultFooter(): string {
  const date = currentDate ?? new Date();
  return `Source code on <a href="https://github.com/amarder/locovote" target="_blank">GitHub</a>. Built on <a title="${formatIsoDate(
    date
  )}">${formatLocaleDate(date)}</a> with <a href="https://observablehq.com/framework/" target="_blank">Observable Framework</a>. Hosted by <a href="https://www.netlify.com/" target="_blank">Netlify</a>.`;
}

// See https://observablehq.com/framework/config for documentation.
export default {
  // The project’s title; used in the sidebar and webpage titles.
  title: "Locovote",

  // The pages and sections in the sidebar. If you don’t specify this option,
  // all pages will be listed in alphabetical order. Listing pages explicitly
  // lets you organize them into sections and have unlisted pages.
  // pages: [
  //   {
  //     name: "Examples",
  //     pages: [
  //       {name: "Dashboard", path: "/example-dashboard"},
  //       {name: "Report", path: "/example-report"}
  //     ]
  //   }
  // ],

  // Content to add to the head of the page, e.g. for a favicon:
  head: '<link rel="icon" href="observable.png" type="image/png" sizes="32x32">',
  footer: defaultFooter(),

  // The path to the source root.
  root: "src",

  // Some additional configuration options and their defaults:
  // theme: "default", // try "light", "dark", "slate", etc.
  // header: "", // what to show in the header (HTML)
  // footer: "Built with Observable.", // what to show in the footer (HTML)
  // sidebar: true, // whether to show the sidebar
  // toc: true, // whether to show the table of contents
  // pager: true, // whether to show previous & next links in the footer
  // output: "dist", // path to the output root for build
  // search: true, // activate search
  // linkify: true, // convert URLs in Markdown to links
  // typographer: false, // smart quotes and other typographic improvements
  // cleanUrls: true, // drop .html from URLs
};
