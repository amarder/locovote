# Compare Municipalities

```js
import {searchCheckbox} from "./components/search-select.js"
```

```js
const arrowData = FileAttachment("./data/municipalities.arrow").arrow();
```

```js
const data = [...arrowData];
const names = [...new Set(data.map(d => d.Municipality))].sort();
```

```js
const selected = view(searchCheckbox(names));
```

```js
display(selected);
```