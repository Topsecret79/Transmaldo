const fs = require('fs');

const path = './src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

// Let's search for "const isClosed = getShiftStatus(currentUser.id, targetDate) === 'closed';"
const anchor = "const isClosed = getShiftStatus(currentUser.id, targetDate) === 'closed';";
const startIndex = content.indexOf(anchor);

if (startIndex === -1) {
  console.error("Could not find anchor 'const isClosed = getShiftStatus...'");
  process.exit(1);
}

console.log("Found anchor at index:", startIndex);

// Now, let's find the "} else {" block after the anchor
const elseIndex = content.indexOf("} else {", startIndex);
if (elseIndex === -1) {
  console.error("Could not find '} else {' block after anchor");
  process.exit(1);
}

console.log("Found '} else {' at index:", elseIndex);

// Let's find the closing return block and end of the IIFE
// The structure is:
// } else {
//   return (
//     ...
//   );
// }
// })()

// We want to find the closing "}" of the "else {" block, which is right before "}" of the IIFE "})()"
// Let's search for "})()" after elseIndex
const iifeCloseIndex = content.indexOf("})()", elseIndex);
if (iifeCloseIndex === -1) {
  console.error("Could not find '})()' after elseIndex");
  process.exit(1);
}

console.log("Found '})()' at index:", iifeCloseIndex);

// The block to replace goes from elseIndex to right before iifeCloseIndex (and we need to be careful with the indentation)
// Let's find the line breaks.
// Let's extract the substring to be absolutely sure
const subToReplace = content.substring(elseIndex, iifeCloseIndex);
console.log("Substring to replace (first 100 chars):", subToReplace.substring(0, 100));
console.log("Substring to replace (last 100 chars):", subToReplace.substring(subToReplace.length - 100));

const replacement = `} else {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <span className="badge" style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: '700' }}>🔓 Turno Abierto</span>
                          
                          <button 
                            type="button" 
                            onClick={() => {
                              if (dayTickets.length === 0) {
                                triggerAlert('No puedes cerrar un turno sin registrar entregas para ese día.', 'error');
                                return;
                              }
                              
                              const currentDriverVal = currentShift?.customDriver || currentUser.label;
                              const currentMatriculaVal = currentShift?.matricula;
                              
                              if (!currentDriverVal || !currentDriverVal.trim() || !currentMatriculaVal || !currentMatriculaVal.trim()) {
                                triggerAlert('El Chofer y la Matrícula del vehículo son campos obligatorios para poder finalizar el turno.', 'error');
                                return;
                              }
                              
                              const existingKms = getRouteKms(currentUser.id, targetDate);
                              setShiftKmsInput(existingKms > 0 ? existingKms.toString() : '');
                              setShiftSummaryDate(targetDate);
                              setShiftSummaryFurgoId(currentUser.id);
                              setShowShiftModal(true);
                            }} 
                            className="btn btn-primary btn-small"
                            style={{ margin: 0, padding: '8px 14px', background: 'var(--warning)', color: '#000', fontWeight: '700' }}
                          >
                            Finalizar Turno
                          </button>
                          
                          <button 
                            type="button" 
                            onClick={() => {
                              setShiftKmsInput('');
                              setShiftSummaryDate(targetDate);
                              setShiftSummaryFurgoId(currentUser.id);
                              setShowShiftModal(true);
                            }} 
                            className="btn btn-secondary btn-small"
                            style={{ margin: 0, padding: '8px 14px', background: '#cbd5e1', color: '#000000', border: '1px solid #94a3b8', fontWeight: '700' }}
                          >
                            📊 Ver Resumen del Día
                          </button>
                        </div>

                        {/* Configuración de Turno Interactiva para el Repartidor */}
                        <div className="glass-panel" style={{ 
                          width: '100%', 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                          gap: '15px', 
                          marginTop: '5px', 
                          padding: '15px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--panel-border)',
                          borderRadius: '8px',
                          boxShadow: 'none'
                        }}>
                          {/* Selector Chofer */}
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <span className="input-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Chofer (Obligatorio) *</span>
                            <select
                              className="form-input"
                              value={currentShift?.customDriver || currentUser.label || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                let newDriver = val;
                                if (val === 'custom_input') {
                                  const typed = window.prompt('Escribe el nombre del chofer:');
                                  if (typed === null) return;
                                  newDriver = typed.trim() || currentUser.label || 'Por asignar';
                                }
                                handleUpdateDriverShiftField('customDriver', newDriver);
                              }}
                              style={{ margin: 0, padding: '6px 10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--panel-border)' }}
                            >
                              <option value="" style={{ color: '#000', background: '#fff' }}>Por asignar</option>
                              <option value="custom_input" style={{ color: '#000', background: '#fff' }}>✍️ Escribir...</option>
                              {currentShift?.customDriver && !employeesList.some(emp => emp.name === currentShift.customDriver) && (
                                <option value={currentShift.customDriver} style={{ color: '#000', background: '#fff' }}>{currentShift.customDriver}</option>
                              )}
                              {employeesList.filter(emp => emp.active !== false).map(emp => (
                                <option key={emp.id} value={emp.name} style={{ color: '#000', background: '#fff' }}>{emp.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Selector Matrícula */}
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <span className="input-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Matrícula (Obligatorio) *</span>
                            <select
                              className="form-input"
                              value={currentShift?.matricula || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                let newPlate = val;
                                if (val === 'custom_input') {
                                  const typed = window.prompt('Escribe la matrícula del vehículo:');
                                  if (typed === null) return;
                                  newPlate = typed.trim().toUpperCase() || '';
                                }
                                handleUpdateDriverShiftField('matricula', newPlate);
                              }}
                              style={{ margin: 0, padding: '6px 10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--panel-border)' }}
                            >
                              <option value="" style={{ color: '#000', background: '#fff' }}>Seleccionar matrícula...</option>
                              <option value="custom_input" style={{ color: '#000', background: '#fff' }}>✍️ Escribir...</option>
                              {currentShift?.matricula && !platesList.includes(currentShift.matricula) && (
                                <option value={currentShift.matricula} style={{ color: '#000', background: '#fff' }}>{currentShift.matricula}</option>
                              )}
                              {platesList.map(plate => (
                                <option key={plate} value={plate} style={{ color: '#000', background: '#fff' }}>{plate}</option>
                              ))}
                            </select>
                          </div>

                          {/* Selector Ayudante */}
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <span className="input-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Ayudante (Opcional)</span>
                            <select
                              className="form-input"
                              value={currentShift?.helper || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                let newHelper = val;
                                if (val === 'custom_input') {
                                  const typed = window.prompt('Escribe el nombre del ayudante:');
                                  if (typed === null) return;
                                  newHelper = typed.trim() || '';
                                }
                                handleUpdateDriverShiftField('helper', newHelper);
                              }}
                              style={{ margin: 0, padding: '6px 10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--panel-border)' }}
                            >
                              <option value="" style={{ color: '#000', background: '#fff' }}>Sin ayudante</option>
                              <option value="custom_input" style={{ color: '#000', background: '#fff' }}>✍️ Escribir...</option>
                              {currentShift?.helper && !employeesList.some(emp => emp.name === currentShift.helper) && (
                                <option value={currentShift.helper} style={{ color: '#000', background: '#fff' }}>{currentShift.helper}</option>
                              )}
                              {employeesList.filter(emp => emp.active !== false).map(emp => (
                                <option key={emp.id} value={emp.name} style={{ color: '#000', background: '#fff' }}>{emp.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Selector Ayudante 2 */}
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <span className="input-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Ayudante 2 (Opcional)</span>
                            <select
                              className="form-input"
                              value={currentShift?.helper2 || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                let newHelper2 = val;
                                if (val === 'custom_input') {
                                  const typed = window.prompt('Escribe el nombre del segundo ayudante:');
                                  if (typed === null) return;
                                  newHelper2 = typed.trim() || '';
                                }
                                handleUpdateDriverShiftField('helper2', newHelper2);
                              }}
                              style={{ margin: 0, padding: '6px 10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--panel-border)' }}
                            >
                              <option value="" style={{ color: '#000', background: '#fff' }}>Sin segundo ayudante</option>
                              <option value="custom_input" style={{ color: '#000', background: '#fff' }}>✍️ Escribir...</option>
                              {currentShift?.helper2 && !employeesList.some(emp => emp.name === currentShift.helper2) && (
                                <option value={currentShift.helper2} style={{ color: '#000', background: '#fff' }}>{currentShift.helper2}</option>
                              )}
                              {employeesList.filter(emp => emp.active !== false).map(emp => (
                                <option key={emp.id} value={emp.name} style={{ color: '#000', background: '#fff' }}>{emp.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  // Wait, we need to end with a line break or spaces matching the IIFE close
                  `;

// Adjust line breaks
const finalReplacement = replacement.replace(/\n/g, '\r\n');

content = content.substring(0, elseIndex) + finalReplacement + content.substring(iifeCloseIndex);
fs.writeFileSync(path, content, 'utf8');
console.log("Success! Replaced UI block.");
