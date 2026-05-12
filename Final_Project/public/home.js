const header = document.querySelector(".home-header");
const showcaseBoard = document.querySelector(".showcase-board");

window.addEventListener("scroll", () => {
  header.classList.toggle("scrolled", window.scrollY > 12);
});

if (showcaseBoard) {
  showcaseBoard.addEventListener("pointermove", (event) => {
    const rect = showcaseBoard.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 8;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * -8;
    showcaseBoard.style.transform = `rotateX(${y}deg) rotateY(${x}deg)`;
  });

  showcaseBoard.addEventListener("pointerleave", () => {
    showcaseBoard.style.transform = "rotateX(0deg) rotateY(0deg)";
  });
}
