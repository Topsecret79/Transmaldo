const fs = require('fs');

const path = './src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Insert State Variables
const shiftsStateStr = `  const [shifts, setShifts] = useState([]);`;
const driverStatesStr = `  const [shifts, setShifts] = useState([]);
  const [driverCustomDriver, setDriverCustomDriver] = useState('');
  const [driverMatricula, setDriverMatricula] = useState('');
  const [driverHelper, setDriverHelper] = useState('');
  const [driverHelper2, setDriverHelper2] = useState('');`;

if (content.includes(shiftsStateStr)) {
  content = content.replace(shiftsStateStr, driverStatesStr);
  console.log("1. Inserted local states successfully!");
} else {
  console.error("Could not find shifts state definition!");
  process.exit(1);
}

// 2. Insert useEffect
const activeRoutesUseEffect = `  useEffect(() => {
    localStorage.setItem('delivery_active_routes', JSON.stringify(activeRoutes));
  }, [activeRoutes]);`;

const driverUseEffect = `  useEffect(() => {
    localStorage.setItem('delivery_active_routes', JSON.stringify(activeRoutes));
  }, [activeRoutes]);

  useEffect(() => {
    if (currentUser && currentUser.role === 'repartidor') {
      const activeDate = shiftSummaryDate || new Date().toISOString().split('T')[0];
      const shiftId = \`\${currentUser.id}_\${activeDate}\`;
      const s = shifts.find(item => item.id === shiftId);
      setDriverCustomDriver(s?.customDriver || currentUser.label || '');
      setDriverMatricula(s?.matricula || '');
      setDriverHelper(s?.helper || '');
      setDriverHelper2(s?.helper2 || '');
    }
  }, [shifts, shiftSummaryDate, currentUser]);`;

const activeRoutesUseEffectCRLF = activeRoutesUseEffect.replace(/\n/g, '\r\n');
const driverUseEffectCRLF = driverUseEffect.replace(/\n/g, '\r\n');

if (content.includes(activeRoutesUseEffectCRLF)) {
  content = content.replace(activeRoutesUseEffectCRLF, driverUseEffectCRLF);
  console.log("2. Inserted useEffect with CRLF successfully!");
} else if (content.includes(activeRoutesUseEffect)) {
  content = content.replace(activeRoutesUseEffect, driverUseEffect);
  console.log("2. Inserted useEffect with LF successfully!");
} else {
  console.error("Could not find activeRoutes useEffect!");
  process.exit(1);
}

// 3. Insert handleSaveDriverShiftSettings and hasUnsavedShiftChanges functions
// We can insert them right before handleUpdateDriverShiftField
const handleUpdateDriverShiftFieldAnchor = `  const handleUpdateDriverShiftField = (field, value) => {`;
const helperFunctionsStr = `  const hasUnsavedShiftChanges = () => {
    if (!currentUser) return false;
    const activeDate = shiftSummaryDate || new Date().toISOString().split('T')[0];
    const shiftId = \`\${currentUser.id}_\${activeDate}\`;
    const s = shifts.find(item => item.id === shiftId);
    
    const dbDriver = s?.customDriver || currentUser.label || '';
    const dbMatricula = s?.matricula || '';
    const dbHelper = s?.helper || '';
    const dbHelper2 = s?.helper2 || '';
    
    return dbDriver !== driverCustomDriver ||
           dbMatricula !== driverMatricula ||
           dbHelper !== driverHelper ||
           dbHelper2 !== driverHelper2;
  };

  const handleSaveDriverShiftSettings = async () => {
    if (!currentUser) return;
    const activeDate = shiftSummaryDate || new Date().toISOString().split('T')[0];
    const shiftId = \`\${currentUser.id}_\${activeDate}\`;
    
    // Validation: driver and plate are mandatory
    if (!driverCustomDriver || !driverCustomDriver.trim() || !driverMatricula || !driverMatricula.trim()) {
      triggerAlert('El Chofer y la Matrícula del vehículo son campos obligatorios.', 'error');
      return;
    }

    const index = shifts.findIndex(s => s.id === shiftId);
    let updatedShifts = [...shifts];
    if (index !== -1) {
      updatedShifts[index] = {
        ...updatedShifts[index],
        customDriver: driverCustomDriver.trim(),
        matricula: driverMatricula.trim(),
        helper: driverHelper,
        helper2: driverHelper2
      };
    } else {
      updatedShifts.push({
        id: shiftId,
        furgoId: currentUser.id,
        date: activeDate,
        status: 'open',
        openedAt: new Date().toISOString(),
        closedAt: null,
        helper: driverHelper,
        helper2: driverHelper2,
        matricula: driverMatricula.trim(),
        customDriver: driverCustomDriver.trim(),
        observations: '',
        routeName: '',
        createdBy: 'driver'
      });
    }
    
    setShifts(updatedShifts);
    await saveShifts(updatedShifts);
    
    // Force sync push
    if (typeof reinitSupabase === 'function') {
      await reinitSupabase();
    }
    triggerAlert('Configuración del turno guardada y sincronizada correctamente');
  };

  const handleUpdateDriverShiftField = (field, value) => {`;

const helperFunctionsStrCRLF = helperFunctionsStr.replace(/\n/g, '\r\n');

if (content.includes(handleUpdateDriverShiftFieldAnchor)) {
  content = content.replace(handleUpdateDriverShiftFieldAnchor, helperFunctionsStrCRLF);
  console.log("3. Inserted helper functions successfully!");
} else {
  console.error("Could not find handleUpdateDriverShiftField!");
  process.exit(1);
}

// 4. Update the interactive configuration box in Driver Portal UI to bind to local states and add Save button
// Let's locate the config box we added previously
const uiAnchorStart = `                        {/* Configuración de Turno Interactiva para el Repartidor */}`;
const uiStartIndex = content.indexOf(uiAnchorStart);

if (uiStartIndex === -1) {
  console.error("Could not find driver config box UI anchor!");
  process.exit(1);
}

console.log("Found UI anchor at index:", uiStartIndex);

// We want to replace the whole glass-panel block up to its closing tag.
// Let's locate the next "</div>" of the glass-panel.
// Wait, to be absolutely safe, let's find the closing return block of the else block.
// Let's replace the whole config box div inside the return block.
// Let's write the new block structure:
const newConfigUIBlock = `                        {/* Configuración de Turno Interactiva para el Repartidor */}
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
                              value={driverCustomDriver}
                              onChange={(e) => {
                                const val = e.target.value;
                                let newDriver = val;
                                if (val === 'custom_input') {
                                  const typed = window.prompt('Escribe el nombre del chofer:');
                                  if (typed === null) return;
                                  newDriver = typed.trim() || currentUser.label || 'Por asignar';
                                }
                                setDriverCustomDriver(newDriver);
                              }}
                              style={{ margin: 0, padding: '6px 10px', fontSize: '0.8rem', background: '#ffffff', color: '#000000', border: '1px solid var(--panel-border)' }}
                            >
                              <option value="" style={{ color: '#000', background: '#fff' }}>Por asignar</option>
                              <option value="custom_input" style={{ color: '#000', background: '#fff' }}>✍️ Escribir...</option>
                              {driverCustomDriver && !employeesList.some(emp => emp.name === driverCustomDriver) && (
                                <option value={driverCustomDriver} style={{ color: '#000', background: '#fff' }}>{driverCustomDriver}</option>
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
                              value={driverMatricula}
                              onChange={(e) => {
                                const val = e.target.value;
                                let newPlate = val;
                                if (val === 'custom_input') {
                                  const typed = window.prompt('Escribe la matrícula del vehículo:');
                                  if (typed === null) return;
                                  newPlate = typed.trim().toUpperCase() || '';
                                }
                                setDriverMatricula(newPlate);
                              }}
                              style={{ margin: 0, padding: '6px 10px', fontSize: '0.8rem', background: '#ffffff', color: '#000000', border: '1px solid var(--panel-border)' }}
                            >
                              <option value="" style={{ color: '#000', background: '#fff' }}>Seleccionar matrícula...</option>
                              <option value="custom_input" style={{ color: '#000', background: '#fff' }}>✍️ Escribir...</option>
                              {driverMatricula && !platesList.includes(driverMatricula) && (
                                <option value={driverMatricula} style={{ color: '#000', background: '#fff' }}>{driverMatricula}</option>
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
                              value={driverHelper}
                              onChange={(e) => {
                                const val = e.target.value;
                                let newHelper = val;
                                if (val === 'custom_input') {
                                  const typed = window.prompt('Escribe el nombre del ayudante:');
                                  if (typed === null) return;
                                  newHelper = typed.trim() || '';
                                }
                                setDriverHelper(newHelper);
                              }}
                              style={{ margin: 0, padding: '6px 10px', fontSize: '0.8rem', background: '#ffffff', color: '#000000', border: '1px solid var(--panel-border)' }}
                            >
                              <option value="" style={{ color: '#000', background: '#fff' }}>Sin ayudante</option>
                              <option value="custom_input" style={{ color: '#000', background: '#fff' }}>✍️ Escribir...</option>
                              {driverHelper && !employeesList.some(emp => emp.name === driverHelper) && (
                                <option value={driverHelper} style={{ color: '#000', background: '#fff' }}>{driverHelper}</option>
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
                              value={driverHelper2}
                              onChange={(e) => {
                                const val = e.target.value;
                                let newHelper2 = val;
                                if (val === 'custom_input') {
                                  const typed = window.prompt('Escribe el nombre del segundo ayudante:');
                                  if (typed === null) return;
                                  newHelper2 = typed.trim() || '';
                                }
                                setDriverHelper2(newHelper2);
                              }}
                              style={{ margin: 0, padding: '6px 10px', fontSize: '0.8rem', background: '#ffffff', color: '#000000', border: '1px solid var(--panel-border)' }}
                            >
                              <option value="" style={{ color: '#000', background: '#fff' }}>Sin segundo ayudante</option>
                              <option value="custom_input" style={{ color: '#000', background: '#fff' }}>✍️ Escribir...</option>
                              {driverHelper2 && !employeesList.some(emp => emp.name === driverHelper2) && (
                                <option value={driverHelper2} style={{ color: '#000', background: '#fff' }}>{driverHelper2}</option>
                              )}
                              {employeesList.filter(emp => emp.active !== false).map(emp => (
                                <option key={emp.id} value={emp.name} style={{ color: '#000', background: '#fff' }}>{emp.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Botón Guardar Cambios del Turno */}
                          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                            {hasUnsavedShiftChanges() && (
                              <span style={{ fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 'bold' }}>
                                ⚠️ Cambios sin guardar
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={handleSaveDriverShiftSettings}
                              className="btn btn-primary"
                              style={{ 
                                margin: 0, 
                                padding: '8px 16px', 
                                background: hasUnsavedShiftChanges() ? 'var(--primary)' : 'rgba(255,255,255,0.1)', 
                                border: '1px solid var(--panel-border)',
                                color: '#ffffff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontWeight: '700',
                                boxShadow: hasUnsavedShiftChanges() ? '0 0 10px rgba(99, 102, 241, 0.4)' : 'none'
                              }}
                            >
                              💾 Guardar Configuración del Turno
                            </button>
                          </div>
                        </div>`;

// Let's find where the closing tag of this glass-panel is in the original file
const closingMarker = '</div>\r\n                      </div>\r\n                    );\r\n                  }';
const closingMarkerLF = '</div>\n                      </div>\n                    );\n                  }';

let closeIndex = content.indexOf(closingMarker, uiStartIndex);
let usesCRLF = true;
if (closeIndex === -1) {
  closeIndex = content.indexOf(closingMarkerLF, uiStartIndex);
  usesCRLF = false;
}

if (closeIndex === -1) {
  console.error("Could not find the closing return block tags!");
  process.exit(1);
}

console.log("Found closing index at:", closeIndex);

// Let's replace from uiStartIndex to closeIndex
const originalLengthBefore = content.length;
const newConfigUIBlockAdjusted = usesCRLF ? newConfigUIBlock.replace(/\n/g, '\r\n') : newConfigUIBlock;

content = content.substring(0, uiStartIndex) + newConfigUIBlockAdjusted + '\n                        </div>' + content.substring(closeIndex);
console.log("Applied UI replacement successfully! Length changed from", originalLengthBefore, "to", content.length);

fs.writeFileSync(path, content, 'utf8');
