// ==UserScript==
// @name         PAMI - Descarga y Carga de Informes
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  PAMI - Descarga y Carga de Informes y Apertura de PDFs
// @author       Diagnosis
// @match        *://*.pami.org.ar/*
// @match        http://localhost:3000/informes/descarga*
// @match        https://dweb.diagnosis.com.ar/informes/descarga*
// @grant        window.focus
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_openInTab
// @grant        GM_download
// @grant        GM_addValueChangeListener
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    //const URL_LOCAL = "localhost:3000/informes/descarga";
    const URL_LOCAL = "dweb.diagnosis.com.ar/informes/descarga";
    const URL_PAMI = "https://pe.pami.org.ar/controllers/transmision.php";

    const urlActual = window.location.href;

    // ==========================================
    // PARTE 1: CÓDIGO PARA LA PÁGINA DE PAMI
    // ==========================================
    if (urlActual.includes(URL_PAMI)) {

        function InyectarBotonesPAMI() {
            const filas = document.querySelectorAll("table.bandeja-transmision tbody tr[data-n-orden]");

            filas.forEach((fila) => {
                const celdas = fila.querySelectorAll("td");

                if (celdas.length > 0) {
                    if (fila.classList.contains("boton-inyectado")) return;
                    fila.classList.add("boton-inyectado");

                    const nroOrden = fila.getAttribute("data-n-orden");
                    const fechaEmision = celdas[1].innerText.trim();
                    const nroBeneficio = fila.getAttribute("data-n-beneficio").trim();
                    const gradoParen = fila.getAttribute("data-c-grado-paren").trim();
                    const practica = celdas[4].innerText.trim();
                    const codigoPracticaLimpio = fila.getAttribute("data-practica").trim();

                    const botonAuto = document.createElement("button");
                    botonAuto.innerText = "⚙️";
                    botonAuto.title = "Enviar a D+Web";

                    botonAuto.style.marginLeft = "8px";
                    botonAuto.style.cursor = "pointer";
                    botonAuto.style.padding = "2px 6px";
                    botonAuto.style.fontSize = "12px";
                    botonAuto.style.border = "1px solid #005b96";
                    botonAuto.style.borderRadius = "4px";
                    botonAuto.style.backgroundColor = "#e1f5fe";

                    botonAuto.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const datosAfiliado = {
                            beneficio: `${nroBeneficio}${gradoParen}`,
                            fecha: fechaEmision,
                            practica: codigoPracticaLimpio,
                            orden: nroOrden
                        };

                        GM_setValue("afiliadoPendiente", datosAfiliado);
                        GM_setValue('enfocar_localhost', true);
                    });

                    celdas[2].appendChild(botonAuto);
                }
            });
        }

        window.addEventListener('load', () => setTimeout(InyectarBotonesPAMI, 2000));

        function procesarSubidaArchivo(orden) {
            if (!orden) return;

            const filaObjetivo = document.querySelector(`tr[data-n-orden="${orden}"]`);
            const inputFile = document.querySelector("input#m_doc");

            if (filaObjetivo && inputFile) {
                inputFile.click();

                GM_setValue('pami_orden_en_modal', null);
            } else {
                console.error("[PAMI] No se puede ejecutar la carga: el modal o el campo de archivo no están en pantalla.");
            }
        }

        document.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                const ordenActiva = GM_getValue('pami_orden_en_modal', null);

                if (ordenActiva) {
                    procesarSubidaArchivo(ordenActiva)
                }
            }
        }, { capture: true });

        const observador = new MutationObserver(() => InyectarBotonesPAMI());
        observador.observe(document.body, { childList: true, subtree: true });

        // =========================================================================
        // LISTENER 1: ABRE EL MODAL Y SELECCIONA LA OPCIÓN formaro PDF
        // =========================================================================
        GM_addValueChangeListener('abrir_modal_pami', function(key, oldValue, newValue, remote) {
            if (remote && newValue && newValue.orden) {
                window.focus();

                setTimeout(() => {
                    const filaObjetivo = document.querySelector(`tr[data-n-orden="${newValue.orden}"]`);

                    if (filaObjetivo) {
                        const botonCargar = filaObjetivo.querySelector("i.upload, i.fa-upload");

                        if (botonCargar) {
                            GM_setValue('pami_orden_en_modal', newValue.orden);

                            botonCargar.click();

                            let intentosModal = 0;
                            const monitorearModal = setInterval(() => {
                                intentosModal++;

                                const selectDoc = document.querySelector("select#m_t_doc");

                                // Esperamos que cargue el select y tenga las opciones disponibles
                                if (selectDoc && selectDoc.options.length > 1 && selectDoc.querySelector('option[value*="17-"]')) {
                                    clearInterval(monitorearModal);
                                    console.log("[PAMI] Modal listo. Iniciando ráfaga de configuración para '17'...");

                                    const opcion17 = selectDoc.querySelector('option[value*="17-"]');
                                    const valorReal17 = opcion17 ? opcion17.value : "17-Informe/Resultados (formato pdf)";

                                    const forzarSeleccionOpcion = () => {
                                        selectDoc.value = valorReal17;
                                        selectDoc.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                                        selectDoc.dispatchEvent(new Event('input', { bubbles: true }));

                                        const jq = typeof unsafeWindow !== 'undefined' && unsafeWindow.jQuery ? unsafeWindow.jQuery : (typeof jQuery !== 'undefined' ? jQuery : null);
                                        if (jq) {
                                            const $select = jq(selectDoc);
                                            $select.val(valorReal17).trigger('change.select2');
                                            $select.trigger('change');
                                        }
                                    };

                                    let ejecucionesRafaga = 0;
                                    const rafagaInsistencia = setInterval(() => {
                                        ejecucionesRafaga++;
                                        forzarSeleccionOpcion();

                                        if (ejecucionesRafaga >= 15) {
                                            clearInterval(rafagaInsistencia);
                                            console.log("[PAMI] Ráfaga de seguridad finalizada.");
                                        }
                                    }, 100);

                                    const nroBeneficio = filaObjetivo.getAttribute("data-n-beneficio").trim();
                                    const gradoParen = filaObjetivo.getAttribute("data-c-grado-paren").trim();
                                    const codigoOS = filaObjetivo.getAttribute("data-practica").trim();
                                    const nombreArchivoABuscar = `C:\\Users\\analu\\Downloads\\pami\\informe_${nroBeneficio}${gradoParen}_${codigoOS}.pdf`;

                                    navigator.clipboard.writeText(nombreArchivoABuscar)
                                        .then(() => console.log(`📋 Nombre copiado: ${nombreArchivoABuscar}`))
                                        .catch(err => console.error("Error al copiar:", err));

                                    GM_setValue('abrir_modal_pami', null); // Limpiamos la señal de apertura de inmediato
                                }

                                if (intentosModal > 50) {
                                    clearInterval(monitorearModal);
                                    console.error("[PAMI] El select de opciones no cargó a tiempo.");
                                    GM_setValue('abrir_modal_pami', null);
                                }
                            }, 100);
                        } else {
                            const botonContenedor = filaObjetivo.querySelector("td:last-child button, td:last-child a");
                            if (botonContenedor) {
                                GM_setValue('pami_orden_en_modal', newValue.orden);
                                botonContenedor.click();
                            }
                            GM_setValue('abrir_modal_pami', null);
                        }
                    } else {
                        console.error(`[PAMI] No se encontró la fila con la orden: ${newValue.orden}`);
                        GM_setValue('abrir_modal_pami', null);
                    }
                }, 300);
            }
        });
    }

    // ==========================================
    // PARTE 2: CÓDIGO PARA D+Web
    // ==========================================
    if (urlActual.includes(URL_LOCAL)) {
        GM_addValueChangeListener('enfocar_localhost', function(key, oldValue, newValue, remote) {
            if (remote && newValue === true) {
                window.focus();
                GM_setValue('enfocar_localhost', false);

                setTimeout(() => {
                    VerificarYProcesarBusqueda();
                }, 100);
            }
        });

        window.addEventListener('load', () => {
            setTimeout(VerificarYProcesarBusqueda, 500);
        });
    }

    function VerificarYProcesarBusqueda() {
        const datos = GM_getValue("afiliadoPendiente", null);
        if (!datos) return;

        window.nroOrdenActualEnProceso = datos.orden;
        GM_setValue("afiliadoPendiente", null);

        let intentosInput = 0;
        const buscarInput = setInterval(() => {
            intentosInput++;
            const buscador = document.querySelector('input[data-slot="input"]');

            if (buscador) {
                clearInterval(buscarInput);

                buscador.focus();

                // Forzar el valor en el estado interno de React
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                setter.call(buscador, datos.beneficio);
                buscador.dispatchEvent(new Event('input', { bubbles: true }));

                setTimeout(() => {
                    const eventoEnter = new KeyboardEvent('keydown', {
                        key: 'Enter',
                        keyCode: 13,
                        code: 'Enter',
                        which: 13,
                        bubbles: true,
                        cancelable: true
                    });
                    buscador.dispatchEvent(eventoEnter);

                    ProcesarDescargaDeInforme(datos.beneficio, datos.practica)
                    // setTimeout(LimpiarBuscadorNextUI, 1500)
                }, 150);
            }

            if (intentosInput > 30) {
                clearInterval(buscarInput);
                console.error("Error: El input de NextUI no apareció en la pantalla.");
            }
        }, 100);
    }

    function ResetearMemoriaLocalhost() {
        console.log("Reseteando buscador y memoria de manera silenciosa...");
        window.nroOrdenActualEnProceso = null; // Eliminamos la orden vieja de la memoria

        const buscador = document.querySelector('input[data-slot="input"]');
        if (!buscador) return;

        // const botonClear = document.querySelector('[data-slot="clear-button"]');
        // if (botonClear) {
        //     botonClear.click();
        // }

        // const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        // setter.call(buscador, "");
        // buscador.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function LimpiarBuscadorNextUI() {
        const buscador = document.querySelector('input[data-slot="input"]');
        if (!buscador) return;

        console.log("Limpiando el buscador...");

        // 1. Intentar hacer click en la "X" de NextUI (clear-button) que nos pasaste en el HTML
        const botonClear = document.querySelector('[data-slot="clear-button"]');
        if (botonClear) {
            botonClear.click();
        }

        // 2. Respaldo directo en el Input por si React no procesó el clic del botón
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(buscador, "");
        buscador.dispatchEvent(new Event('input', { bubbles: true }));

        console.log("Buscador limpio y listo.");

        const ordenARetornar = window.nroOrdenActualEnProceso;
        if (ordenARetornar) {
            window.nroOrdenActualEnProceso = null; // Vaciamos memoria local
            console.log(`Enviando comando de carga a PAMI para la orden: ${ordenARetornar}`);
            GM_setValue('abrir_modal_pami', { orden: ordenARetornar });
        }
    }

    function ProcesarDescargaDeInforme(afiliado, codigoBuscado) {
        let intentos = 0;

        const buscarTablaResultados = setInterval(() => {
            intentos++;

            const textoPagina = document.body.innerText;
            if (
                textoPagina.includes("No se ha encontrado al paciente") || 
                textoPagina.includes("No se han encontrado estudios") || 
                textoPagina.includes("último mes") || 
                textoPagina.includes("not found")
            ) {
                clearInterval(buscarTablaResultados);
                console.log("Error detectado en pantalla (Paciente ausente o sin estudios recientes). Reseteando...");
                ResetearMemoriaLocalhost();
                return;
            }

            const filasResultados = document.querySelectorAll("table tbody tr");

            if (filasResultados.length > 0) {
                const primerCelda = filasResultados[0].querySelector("td");
                if (primerCelda && (primerCelda.innerText.includes("ningún") || primerCelda.innerText.includes("No dejes"))) {
                    if (intentos > 60) {
                        clearInterval(buscarTablaResultados);
                        ResetearMemoriaLocalhost(); // Limpiamos porque terminó el proceso (sin datos)
                    }
                    return;
                }

                clearInterval(buscarTablaResultados);

                let filaEncontrada = false;

                filasResultados.forEach((fila) => {
                    const celdas = fila.querySelectorAll("td");

                    if (celdas.length >= 4) {
                        const codigoOS = celdas[1].innerText.trim();

                        if (codigoBuscado.includes(codigoOS) || codigoOS.includes(codigoBuscado)) {
                            filaEncontrada = true;

                            const botonDescarga = fila.querySelector("button, a, [role='button']");

                            if (botonDescarga) {
                                const urlDescarga = botonDescarga.getAttribute("data-url") || botonDescarga.getAttribute("href");

                                if (urlDescarga) {
                                    GM_openInTab(urlDescarga, { active: false, insert: true });
                                }

                                const urlDirecta = botonDescarga.getAttribute("data-url");
                                if (urlDirecta) {
                                    GM_download({
                                        url: urlDirecta,
                                        name: `pami/informe_${afiliado}_${codigoOS}.pdf`,
                                        onload: () => {
                                            console.log("Descarga silenciosa completada con éxito en el disco.");
                                            // AHORA SÍ: El archivo se guardó completamente, procedemos a limpiar
                                            LimpiarBuscadorNextUI();
                                        }
                                    });
                                }
                            }
                        }
                    }
                });

                if (!filaEncontrada) {
                    console.log(`No se encontró ninguna fila en tu sistema que coincida con el código de práctica de PAMI: ${codigoBuscado}`);
                    window.alert(`No se encontró ninguna fila en tu sistema que coincida con el código de práctica de PAMI: ${codigoBuscado}`);
                    // Si la tabla cargó pero la práctica no coincide, el proceso terminó; limpiamos
                    // ResetearMemoriaLocalhost();
                }
            }

            if (intentos > 60) {
                clearInterval(buscarTablaResultados);
                console.log("Tiempo de espera agotado. Los resultados no cargaron.");
                // ResetearMemoriaLocalhost();
            }
        }, 150);
    }

})();
