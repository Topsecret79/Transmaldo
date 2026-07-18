const fs = require('fs');

const path = './src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

const anchor = `  const handleReopenShift = (furgoId, date) => {
    if (window.confirm(\`¿Estás seguro de que deseas reabrir el turno del día \${date} para esta furgoneta?\`)) {
      reopenShift(furgoId, date);
      triggerAlert('Turno reabierto correctamente');
      loadData();
    }
  };`;

const target = `  const handleReopenShift = (furgoId, date) => {
    if (window.confirm(\`¿Estás seguro de que deseas reabrir el turno del día \${date} para esta furgoneta?\`)) {
      reopenShift(furgoId, date);
      triggerAlert('Turno reabierto correctamente');
      loadData();
    }
  };

  const handleUpdateDriverShiftField = (field, value) => {
    const shiftId = \`\${currentUser.id}_\${targetDate}\`;
    const index = shifts.findIndex(s => s.id === shiftId);
    
    let updatedShifts = [...shifts];
    if (index !== -1) {
      updatedShifts[index] = {
        ...updatedShifts[index],
        [field]: value
      };
    } else {
      updatedShifts.push({
        id: shiftId,
        furgoId: currentUser.id,
        date: targetDate,
        status: 'open',
        openedAt: new Date().toISOString(),
        closedAt: null,
        helper: field === 'helper' ? value : '',
        helper2: field === 'helper2' ? value : '',
        matricula: field === 'matricula' ? value : '',
        customDriver: field === 'customDriver' ? value : (currentUser.label || ''),
        observations: '',
        routeName: '',
        createdBy: 'driver'
      });
    }
    
    setShifts(updatedShifts);
    saveShifts(updatedShifts);
    
    let alertMsg = 'Campo de turno actualizado';
    if (field === 'customDriver') alertMsg = 'Chofer actualizado';
    if (field === 'matricula') alertMsg = 'Matrícula actualizada';
    if (field === 'helper') alertMsg = 'Ayudante actualizado';
    if (field === 'helper2') alertMsg = 'Segundo ayudante actualizado';
    triggerAlert(alertMsg);
  };`;

// Use generic replace or handle CRLF / LF
const anchorCRLF = anchor.replace(/\n/g, '\r\n');
const targetCRLF = target.replace(/\n/g, '\r\n');

if (content.includes(anchorCRLF)) {
  content = content.replace(anchorCRLF, targetCRLF);
  console.log("Replaced with CRLF");
} else if (content.includes(anchor)) {
  content = content.replace(anchor, target);
  console.log("Replaced with LF");
} else {
  console.error("Could not find handleReopenShift in App.jsx");
}

fs.writeFileSync(path, content, 'utf8');
