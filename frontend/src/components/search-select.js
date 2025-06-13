// https://observablehq.com/@john-guerra/search-checkbox

import * as Inputs from "npm:@observablehq/inputs";
import * as htl from "npm:htl";

export function searchCheckbox(
    data, // An array of possible selectable options
    options
  ) {
    // -------------------------------------------------------------
    // Multi-Auto-Select implementation (inspired by
    // https://observablehq.com/@john-guerra/multi-auto-select)
    // -------------------------------------------------------------
    options = {
      value: [],
      format: (d) => d,
      optionsSearch: {
        format: () => "",
        filter: fullSearchFilter // search across the whole word
      },
      height: 250,
      debug: false,
      urlParam: undefined, // name of the URL search parameter to sync (e.g., "municipalities")
      ...options,
    };

    const debug = options.debug;

    // ------------------------------------
    // URL parameter helpers (optional)
    // ------------------------------------
    const urlParamName = options.urlParam;

    function readFromURL() {
      if (!urlParamName) return [];
      const params = new URLSearchParams(window.location.search);
      const raw = params.get(urlParamName);
      if (!raw) return [];
      return raw.split(",").map(decodeURIComponent).filter((d) => data.includes(d));
    }

    function writeToURL(values) {
      if (!urlParamName) return;
      const params = new URLSearchParams(window.location.search);
      if (values.length) {
        params.set(urlParamName, values.map(encodeURIComponent).join(","));
      } else {
        params.delete(urlParamName);
      }
      const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
      history.replaceState(null, "", newUrl);
    }

    // Coerce data to an array so we can mutate/filter easily
    data = Array.from(data);

    // Maintain the current selection as an ordered array. If the caller didn't
    // provide an explicit value (or it's empty), fall back to what we find in
    // the URL search params.
    const initialSelection =
      options.value && options.value.length ? options.value : readFromURL();

    let selected = Array.from(initialSelection);

    /* ------------------------------------
     * Core DOM elements
     * ----------------------------------*/
    const search = Inputs.search(data, options.optionsSearch || options);

    // Small helper to quickly style inline elements
    function css(node, styles) {
      Object.assign(node.style, styles);
      return node;
    }

    // Readable counter of selected items
    const output = htl.html`<output style="font-size: 80%; font-style: italic; margin-left: -65px;"></output>`;

    // Container for the selected tags
    const tagList = css(htl.html`<div></div>`, {
      display: "flex",
      flexWrap: "wrap",
      gap: "4px",
      margin: "4px 0"
    });

    // Container for the suggestion list
    const suggestions = css(htl.html`<div></div>`, {
      position: "absolute",
      left: "0",
      top: "100%",
      maxHeight: `${options.height}px`,
      overflow: "auto",
      border: "1px solid #ddd",
      borderRadius: "4px",
      width: "256px",
      background: "#fff",
      zIndex: 1000,
      display: "none" // hidden until there are search results
    });

    // Wrapper to keep suggestions positioned relative to search input
    const searchWrapper = css(htl.html`<div style="position:relative; width:256px;"></div>`, {});
    searchWrapper.append(search, suggestions);

    // Clear-all button (acts as the original "Clear")
    const btnClear = htl.html`<button>Clear</button>`;

    // Compose component root
    const component = htl.html`${options.label ? htl.html`<label>${options.label}</label>` : ""}
${tagList}
<div style="display: flex; gap: 4px; align-items: center;">
  ${searchWrapper}
  ${output}
</div>
`;

    /* ------------------------------------
     * Helper functions
     * ----------------------------------*/

    // Ensure no duplicates inside selected list
    function addSelection(d) {
      if (!selected.includes(d)) selected.push(d);
    }

    function removeSelection(d) {
      selected = selected.filter((x) => x !== d);
    }

    function setSelection(arr) {
      selected = Array.from(arr || []);
    }

    function getSelection() {
      return selected.slice(); // defensive copy
    }

    function countSelected() {
      return selected.length;
    }

    // Update the `<output>` element with current stats
    function updateOutput() {
      output.innerHTML = `(${countSelected()} of ${data.length} selected)`;
    }

    // Render the tag list (selected items)
    function renderTags() {
      tagList.innerHTML = "";
      for (const d of selected) {
        const tag = htl.html`<span style="display:inline-flex; align-items:center; background:#e0e0e0; border-radius:12px; padding:2px 6px; font-size:90%; color:#000;">
          ${options.format(d)}
          <button style="margin-left:4px; border:none; background:transparent; cursor:pointer; font-size: 12px; line-height: 12px; color:#000;">×</button>
        </span>`;
        tag.querySelector("button").addEventListener("click", () => {
          removeSelection(d);
          triggerChange();
        });
        tagList.appendChild(tag);
      }
    }

    // Compute the current suggestion candidates (not already selected)
    function currentCandidates() {
      return (search.value || []).filter((d) => !selected.includes(d));
    }

    // Render the suggestion list under the search box
    function renderSuggestions() {
      suggestions.innerHTML = "";
      const inputEl = search.querySelector("input") || search;
      const queryText = (inputEl.value || "").trim();

      // If the user hasn't typed anything, keep the suggestions hidden
      if (!queryText) {
        suggestions.style.display = "none";
        return;
      }

      const candidates = currentCandidates();

      if (!candidates.length) {
        suggestions.style.display = "none";
        return;
      }

      for (const d of candidates) {
        const item = htl.html`<div style="cursor:pointer; padding:2px 6px; color:#000;">${options.format(d)}</div>`;
        item.addEventListener("click", () => {
          addSelection(d);
          // Clear the search query to make UX smoother
          const inputEl = search.querySelector("input") || search;
          if (inputEl) {
            inputEl.value = "";
            inputEl.dispatchEvent(new Event("input", { bubbles: true }));
          }
          suggestions.style.display = "none";
          triggerChange();
        });
        suggestions.appendChild(item);
      }

      suggestions.style.display = "block";
    }

    // Central place to update everything & dispatch `input` events
    function triggerChange() {
      if (debug) console.log("searchCheckbox (multi-auto)", selected);
      updateOutput();
      renderTags();
      renderSuggestions();
      writeToURL(selected);
      component.dispatchEvent(new Event("input", { bubbles: true }));
    }

    /* ------------------------------------
     * Event listeners
     * ----------------------------------*/
    search.addEventListener("input", () => {
      renderSuggestions();
    });

    btnClear.addEventListener("click", () => {
      setSelection([]);
      triggerChange();
    });

    /* ------------------------------------
     * Expose reactive value
     * ----------------------------------*/
    Object.defineProperty(component, "value", {
      get() {
        return getSelection();
      },
      set(v) {
        setSelection(v);
        triggerChange();
      }
    });

    // Initial rendering
    triggerChange();

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