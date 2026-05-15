export function calcularET0Diaria(datos15min) {
    const porDia = {};

    datos15min.forEach(d => {
        const fecha = d.fecha.split("T")[0];
        const valor = parseFloat(d.et0_fao_evapotranspiration) || 0;

        if (!porDia[fecha]) porDia[fecha] = 0;
        porDia[fecha] += valor;
    });

    return Object.entries(porDia).map(([fecha, et0]) => ({
        fecha,
        et0: parseFloat(et0.toFixed(2))
    }));
}
