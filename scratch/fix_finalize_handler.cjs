const fs = require('fs');

const path = './src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

const targetHandler = `                          <button 
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
                            }}`;

const replacementHandler = `                          <button 
                            type="button" 
                            onClick={async () => {
                              if (dayTickets.length === 0) {
                                triggerAlert('No puedes cerrar un turno sin registrar entregas para ese día.', 'error');
                                return;
                              }
                              
                              if (!driverCustomDriver || !driverCustomDriver.trim() || !driverMatricula || !driverMatricula.trim()) {
                                triggerAlert('El Chofer y la Matrícula del vehículo son campos obligatorios para poder finalizar el turno.', 'error');
                                return;
                              }

                              // Auto-save any unsaved changes before opening the finalization modal
                              if (hasUnsavedShiftChanges()) {
                                await handleSaveDriverShiftSettings();
                              }
                              
                              const existingKms = getRouteKms(currentUser.id, targetDate);
                              setShiftKmsInput(existingKms > 0 ? existingKms.toString() : '');
                              setShiftSummaryDate(targetDate);
                              setShiftSummaryFurgoId(currentUser.id);
                              setShowShiftModal(true);
                            }}`;

const targetHandlerCRLF = targetHandler.replace(/\n/g, '\r\n');
const replacementHandlerCRLF = replacementHandler.replace(/\n/g, '\r\n');

if (content.includes(targetHandlerCRLF)) {
  content = content.replace(targetHandlerCRLF, replacementHandlerCRLF);
  console.log("Successfully updated Finalizar Turno onClick handler with CRLF!");
} else if (content.includes(targetHandler)) {
  content = content.replace(targetHandler, replacementHandler);
  console.log("Successfully updated Finalizar Turno onClick handler with LF!");
} else {
  console.error("Could not find the target Finalizar Turno onClick handler in App.jsx!");
}

fs.writeFileSync(path, content, 'utf8');
