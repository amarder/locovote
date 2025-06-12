// https://observablehq.com/@john-guerra/search-checkbox

import * as Inputs from "npm:@observablehq/inputs";
import * as htl from "npm:htl";

export function searchCheckbox(
    data, // An array of possible selectable options
    options
  ) {
    options = {
      value: [],
      optionsCheckboxes: undefined, // use this if you want to pass specific options to the checkboxes or the search,
      format: (d) => d,
      optionsSearch: {
        format: () => "",
        filter: fullSearchFilter // searches in the whole word
      },
      height: 300,
      debug: false,
      ...options,    
    };
  
    // To remove the label from the options for the checkboxes
    function cloneIgnoring(obj, attrToIgnore) {
      const { [attrToIgnore]: _, ...rest } = obj;
      return rest;
    }
  
    
    let debug = options.debug;
    data = Array.from(data);
    // options.value = options.value === undefined ? [] : options.value;
    let checkboxes = Inputs.checkbox(
      data,
      options.optionsCheckboxes || cloneIgnoring(options, "label")
    );
    const search = Inputs.search(data, options.optionsSearch || options);
    const btnAll = htl.html`<button>All</button>`;
    const btnNone = htl.html`<button>Clear</button>`;
  
    let selected = new Map(Array.from(options.value).map((d) => [d, true]));
  
    function countSelected() {
      return Array.from(selected.entries()).filter(([k, v]) => v).length;
    }
  
    function changeSome(sel, changeTo) {
      for (let o of sel) selected.set(o, changeTo);
    }
  
    function selectedFromArray(sel) {
      changeSome(data, false);
      changeSome(sel, true);
    }
  
    function selectedToArray() {
      return Array.from(selected.entries())
        .filter(([k, v]) => v)
        .map(([k, v]) => k);
    }
  
    // HTML
    let output = htl.html`<output style="font-size: 80%; font-style: italics">(${countSelected()} of ${
      data.length
    } selected)</output>`;
    const component = htl.html`${
      options.label ? htl.html`<label>${options.label}</label>` : ""
    } 
  
    ${output}  
    
    <div style="display:flex">
      ${search} 
      <div> ${btnNone} </div>
    </div>
    
    <div style="max-height: ${
      options.height
    }px; overflow: auto">${checkboxes}</div>`;
  
    // Update the display whenever the value changes
    Object.defineProperty(component, "value", {
      get() {
        return selectedToArray();
      },
      set(v) {
        selectedFromArray(v);
      }
    });
  
    function updateValueFromSelected() {
      checkboxes.value = selectedToArray();
      if (debug) console.log("searchCheckboxes", checkboxes.value);
      output.innerHTML = `(${countSelected()} of ${data.length} selected)`;
      component.dispatchEvent(new Event("input", { bubbles: true }));
  
      // inocuous change to recompute layout. Necesary when the format funtion sets max-height for example
      component.style.zIndex = 1;
    }
  
    btnAll.addEventListener("click", () => {
      changeSome(search.value, true);
      updateValueFromSelected();
    });
    btnNone.addEventListener("click", () => {
      changeSome(search.value, false);
      updateValueFromSelected();
    });
  
    component.value = selectedToArray();
  
    search.addEventListener("input", (evt) => {
      // Hide all the checkboxes that aren't in the searchbox result
      for (let check of checkboxes.querySelectorAll("input")) {
        if (search.value.includes(data[+check.value])) {
          check.parentElement.style.display = "inline-flex";
        } else {
          check.parentElement.style.display = "none";
        }
      }
      // We don't really need to update when value when searching
      // component.dispatchEvent(new Event("input", { bubbles: true }));
    });
  
    checkboxes.addEventListener("input", (evt) => {
      // avoids duplicated events
      evt.stopPropagation();
  
      selectedFromArray(checkboxes.value);
      updateValueFromSelected();
    });
  
    return component;
  }

  // https://github.com/observablehq/inputs/blob/main/src/search.js
function fullSearchFilter(query) {
    const filters = `${query}`
      .split(/\s+/g)
      .filter((t) => t)
      .map(termFilter);
    return (d) => {
      if (d == null) return false;
      if (typeof d === "object") {
        out: for (const filter of filters) {
          for (const value of valuesof(d)) {
            if (filter.test(value)) {
              continue out;
            }
          }
          return false;
        }
      } else {
        for (const filter of filters) {
          if (!filter.test(d)) {
            return false;
          }
        }
      }
      return true;
    };
  }

  function termFilter(term) {
    return new RegExp(`(?:^.*|[^\\p{L}-])${escapeRegExp(term)}`, "iu");
  }

  function escapeRegExp(text) {
    return text.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  }