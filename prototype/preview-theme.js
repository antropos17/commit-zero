(() => {
  const apply = (theme) => {
    document.documentElement.dataset.theme =
      theme === "dark" ? "dark" : "light";
    window.dispatchEvent(new Event("preview-theme-change"));
  };
  apply(new URLSearchParams(location.search).get("theme"));
  window.addEventListener("message", (event) => {
    if (
      event.source === parent &&
      event.data?.type === "commit-zero-theme" &&
      ["light", "dark"].includes(event.data.theme)
    )
      apply(event.data.theme);
  });
})();
