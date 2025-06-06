---
title: General Fund
---

```js
const municipalities = FileAttachment("./data/general-fund.arrow").arrow().then(data => 
  Array.from(data).map(d => ({
    ...d,
    'Fiscal Year': Number(d['Fiscal Year']),
    'exp_Education': Number(d['exp_Education'])
  }))
)
```

```js
const towns = [...new Set((await municipalities).map(d => d.Municipality))];
```

```js
const selectedMunicipalities = view(Inputs.select(
  towns, 
  {
    label: "Select Municipalities", 
    multiple: true, 
    value: ["Abington", "Boston", "Cambridge"],
    sort: true
  }
))
```

```js
const filteredMunicipalities = (await municipalities).filter(d => selectedMunicipalities.includes(d.Municipality));
```

```js
Plot.plot({
  width: 1000,
  height: 600,
  y: {
    grid: true,
    label: "Education Spending ($)",
    transform: d => d / 1_000_000, // Convert to millions
    tickFormat: "~s"
  },
  x: {
    label: "Fiscal Year"
  },
  marks: [
    Plot.line(filteredMunicipalities, {
      x: "Fiscal Year",
      y: "exp_Education",
      stroke: "Municipality",
      strokeWidth: 1.5
    }),
    Plot.dot(filteredMunicipalities, {
      x: "Fiscal Year",
      y: "exp_Education",
      stroke: "Municipality",
      fill: "white"
    }),
    Plot.text(filteredMunicipalities, Plot.selectLast({
      x: "Fiscal Year",
      y: "exp_Education",
      z: "Municipality",
      text: "Municipality",
      textAnchor: "start",
      dx: 4
    }))
  ],
  color: {
    legend: true
  },
  caption: "Education spending by municipality over time (in millions of dollars)"
})