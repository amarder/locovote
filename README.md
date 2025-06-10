# Locovote

Welcome to the source code underlying [locovote.com](https://locovote.com/). Locovote is built with [Observable Framework](https://observablehq.com/framework/) and deployed using [Cloudflare Pages](https://pages.cloudflare.com/). Feel free to share feedback on how to improve the site or even submit pull requests!

Observable Framework has support for [data loaders](https://observablehq.com/framework/data-loaders). "Data loaders live in the source root (typically `src`) alongside your other source files. When a file is referenced from JavaScript via `FileAttachment`, if the file does not exist, Framework will look for a file of the same name with a double extension to see if there is a corresponding data loader." I chose not to use data loaders to keep the site build time fast (about 30 seconds right now). I have included my R code in case you're interested to see how the data was cleaned.

## Tasks

- Set up map: https://observablehq.com/framework/lib/topojson
    https://observablehq.com/plot/transforms/centroid
    https://talk.observablehq.com/t/observable-plot-heat-map-how-to-create-tooltip/9348
    https://www.mass.gov/info-details/massgis-data-municipalities
    https://mapshaper.org/

- labels on facets aren't great, but that seems not critical
- It would be nice to see spending per student.
- Better search https://observablehq.com/@john-guerra/multi-auto-select
- Table is nice with sparklines: https://observablehq.com/framework/inputs/table
- Schools: Improve labels (ELA = English Language Arts, years generally don't have commas)
- Links to specific reports (put town in URL)

Pieces of data I want:

- **account for inflation** https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=Socioeconomic.consumer.consumerpriceindex&rdSubReport=True&rdResizeFrame=True
Implicit Price Deflator and Consumer Price Index  
Division of Local Services
Measures of Inflation on goods and services (US Bureau of Labor Statistics)

Merge school data onto municipalities

spending at each school: http://www.doe.mass.edu/finance/statistics/