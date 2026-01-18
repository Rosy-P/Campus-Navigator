window.addEventListener("load", () => {
  setTimeout(() => {
    document.getElementById("splash").style.display = "none";
    document.getElementById("app").classList.remove("hidden");
    document.getElementById("searchBar").classList.remove("hidden");
  }, 3000);
});
