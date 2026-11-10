import { useEffect } from "react";

// General2 GEN_01 / GEN_02: on phones every table turns into a stack of small cards
// (one per row) so nothing is cut off or needs sideways scrolling. To label each value
// the card needs to know its column, so this copies each header's text onto the cells
// below it (as data-label). It watches the page, so tables that load later — and
// translated headers — are labelled too. Wide tables meant to scroll (class "keep-table")
// are left alone.
export default function TableLabels() {
  useEffect(() => {
    let scheduled = false;

    function label() {
      scheduled = false;
      document.querySelectorAll("table:not(.keep-table):not(.compare-table)").forEach((table) => {
        const heads = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent.trim());
        if (heads.length === 0) return;
        table.querySelectorAll("tbody tr").forEach((tr) => {
          Array.from(tr.children).forEach((td, i) => {
            if (td.tagName !== "TD") return;
            if (td.hasAttribute("colspan")) return;
            const text = heads[i] || "";
            if (td.getAttribute("data-label") !== text) td.setAttribute("data-label", text);
          });
        });
      });
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(label);
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    label();
    return () => observer.disconnect();
  }, []);

  return null;
}
