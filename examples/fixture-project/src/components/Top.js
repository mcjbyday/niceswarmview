function Top({ items, open, onToggle }) {
  return <nav><a href="#home" onClick={onToggle}>{open ? 'close' : 'open'}</a><span>{items.length}</span></nav>
}
export default Top
