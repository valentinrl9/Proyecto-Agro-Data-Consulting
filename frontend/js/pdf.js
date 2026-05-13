document.getElementById("btn-pdf").addEventListener("click", () => {
    const iframe = document.getElementById("iframe-informe");
    iframe.contentWindow.print();
});
