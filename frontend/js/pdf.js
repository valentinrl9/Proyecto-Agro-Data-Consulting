const btn = document.getElementById("btn-pdf");
if (btn) {
    btn.addEventListener("click", () => {
        const iframe = document.getElementById("iframe-informe");
        iframe.contentWindow.print();
    });
}
