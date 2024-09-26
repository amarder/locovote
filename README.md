# Locovote

Welcome to the source code underlying [Locovote](https://locovote.com/). Locovote is built on top of [Observable Framework](https://observablehq.com/framework/) and deployed using [Netlify](https://www.netlify.com/). Feel free to share feedback on how to improve the site or even submit pull requests!

Observable Framework does have support for [data loaders](https://observablehq.com/framework/data-loaders). "Data loaders live in the source root (typically `src`) alongside your other source files. When a file is referenced from JavaScript via `FileAttachment`, if the file does not exist, Framework will look for a file of the same name with a double extension to see if there is a corresponding data loader." I've chosen not use data loaders to keep the site build fast (about 30 seconds right now). I have included my R code in case you interested to see how the data was cleaned.

## Tasks

- It would be nice to see spending per student.
- Put parameters in URL
- Set up footnotes
- Better search https://observablehq.com/@john-guerra/multi-auto-select
- Table is nice with sparklines: https://observablehq.com/framework/inputs/table
- Set up map: https://observablehq.com/framework/lib/topojson
- Optimize for mobile - not sure what resolution to go with.
