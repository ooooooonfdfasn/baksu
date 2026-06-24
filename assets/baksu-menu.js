const menuButton = document.querySelector("#menuButton");
const siteMenu = document.querySelector("#siteMenu");

if (menuButton && siteMenu) {
  menuButton.addEventListener("click", () => {
    const isOpen = siteMenu.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "메뉴 닫기" : "메뉴 열기");
  });

  siteMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteMenu.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "메뉴 열기");
    });
  });
}
