(() => {
  const btn = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-mobile-nav]");
  if (!btn || !nav) return;
  btn.addEventListener("click", () => {
    nav.classList.toggle("is-open");
  });
})();
