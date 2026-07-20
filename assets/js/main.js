// PCHL site — shared behavior
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");

  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const isOpen = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    links.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Expand/collapse issue detail cards
  document.querySelectorAll(".issue-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".issue-card");
      const isOpen = card.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(isOpen));
      btn.querySelector(".issue-toggle-label").textContent = isOpen ? "접기" : "자세히 보기";
    });
  });

  // Mark current nav link
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((a) => {
    const href = a.getAttribute("href");
    if (href === path || (path === "" && href === "index.html")) {
      a.setAttribute("aria-current", "page");
    }
  });
});
