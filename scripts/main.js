// main.js - Script per la homepage
// Effetti e animazioni generali della home

// ─── Gestione bottone Login ────────────────────────────────────────────────────
function openLoginModal() {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    window.location.href = user ? './user.html' : './login.html';
}

document.addEventListener("DOMContentLoaded", () => {
    // Animazione scroll sulle sezioni
    const sections = document.querySelectorAll("section");
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = "1";
                entry.target.style.transform = "translateY(0)";
            }
        });
    }, { threshold: 0.1 });

    sections.forEach(section => {
        section.style.opacity = "0";
        section.style.transform = "translateY(30px)";
        section.style.transition = "opacity 0.6s ease, transform 0.6s ease";
        observer.observe(section);
    });
});
