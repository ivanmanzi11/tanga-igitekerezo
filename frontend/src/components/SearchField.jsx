/** General2 ADM_05: every search section gets a blue search button attached
 * to it, not just a bare text input. Enter also triggers the search. */
export default function SearchField({ value, onChange, onSearch, placeholder, style }) {
  return (
    <div className="search-field" style={style}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSearch?.(value);
        }}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="btn-search"
        onClick={() => onSearch?.(value)}
        aria-label="Search"
        title="Search"
      >
        🔍
      </button>
    </div>
  );
}
