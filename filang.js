#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');
const { execSync } = require('child_process');

let currentPath = process.cwd();

// Funkcje do pobierania plików i folderów
function getAllFiles() {
  return fs.readdirSync(currentPath).filter(f => fs.statSync(path.join(currentPath, f)).isFile());
}

function getAllFolders() {
  return fs.readdirSync(currentPath).filter(f => fs.statSync(path.join(currentPath, f)).isDirectory());
}

function getAllItems() {
  return fs.readdirSync(currentPath);
}

// Lista dostępnych poleceń do auto-uzupełniania
const commands = [
	'LOAD', 'DELETE FILE', 'DELETE FILES', 'DELETE FOLDERS', 'DELETE FOLDER',
	'READ FILE', 'CREATE FILE', 'WRITE FILE', 'UPDATE FILE',
	'CREATE FOLDER', 'USE', 'DROP', 'LIST FILE', 'LIST FOLDER', 'LIST *',
	'MOVE FILE', 'MOVE FILES', 'MOVE FOLDER', 'MOVE FOLDERS',
	'COPY FILE', 'COPY FILES', 'COPY FOLDER', 'COPY FOLDERS',
	'RENAME FILE', 'RENAME FOLDER', 'COUNT FILES', 'COUNT FOLDERS', 'COUNT ALL',
	'SELECT FILES', 'SELECT FOLDERS', 'MERGE', 'FMLE FILE'
];
// Funkcja auto-uzupełniania – inteligentnie filtruje polecenia
function autoCompleter(line) {
  // Dopasowujemy komendy, porównując z wpisanym tekstem (bez względu na wielkość liter)
  const hits = commands.filter(c => c.startsWith(line.toUpperCase()));
  return [hits.length ? hits : commands, line];
}

// Konfiguracja interfejsu readline z auto-uzupełnianiem
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `${currentPath} >> `,
  completer: autoCompleter
});

function updatePrompt() {
  rl.setPrompt(`${currentPath} >> `);
  rl.prompt();
}

// Funkcje logowania wiadomości
function logInfo(message) {
  console.log(`[INFO] ${message}`);
}

function logWarning(message) {
  console.log(`[WARNING] ${message}`);
}

function logError(message) {
  console.log(`[ERROR] ${message}`);
}

function logSuccess(message) {
  console.log(`[SUCCESS] ${message}`);
}

// Interpretacja komend
function interpret(command) {
  const trimmed = command.trim();
  if (trimmed === '') return;

  // Obsługuje komendę LOAD (wczytuje plik .fql)
  if (/^LOAD\s+"([^"]+\.fql)"$/i.test(trimmed)) {
    const [, filename] = trimmed.match(/^LOAD\s+"([^"]+\.fql)"$/i);
    return loadFQL(filename);
  }

  // Obsługuje komendy DELETE FILE, DELETE FILES, DELETE FOLDERS, etc.
  if (trimmed.match(/^DELETE FILE\s+"\*"+$/i)) {
    getAllFiles().forEach(f => deleteFile(f));
    return;
  }

  if (/^DELETE FILES(?: FROM "([^"]+)")?(?: WHERE (.+))?$/i.test(trimmed)) {
    const [, fromPath, whereClause] = trimmed.match(/^DELETE FILES(?: FROM "([^"]+)")?(?: WHERE (.+))?$/i);
    return deleteFilesAdvanced({ fromPath, whereClause });
  }

  if (/^DELETE FOLDERS(?: FROM "([^"]+)")?(?: WHERE (.+))?$/i.test(trimmed)) {
    const [, fromPath, whereClause] = trimmed.match(/^DELETE FOLDERS(?: FROM "([^"]+)")?(?: WHERE (.+))?$/i);
    return deleteFoldersAdvanced({ fromPath, whereClause });
  }

  if (trimmed.match(/^DELETE FOLDER\s+"\*"+$/i)) {
    getAllFolders().forEach(f => deleteFolder(f));
    return;
  }

  if (trimmed.match(/^READ FILE\s+"\*"+$/i)) {
    getAllFiles().forEach(f => readFile(f));
    return;
  }

  // Obsługuje komendy CREATE FILE, READ FILE, WRITE FILE, UPDATE FILE, etc.
  if (/^CREATE FILE\s+"[^"]+"$/i.test(trimmed)) {
    const filename = trimmed.match(/^CREATE FILE\s+"([^"]+)"$/i)[1];
    return createFile(filename);
  }

  if (/^READ FILE\s+"[^"]+"$/i.test(trimmed)) {
    const filename = trimmed.match(/^READ FILE\s+"([^"]+)"$/i)[1];
    return readFile(filename);
  }

  if (/^WRITE FILE\s+"[^"]+"\s+TO\s+".*"$/i.test(trimmed)) {
    const [, filename, content] = trimmed.match(/^WRITE FILE\s+"([^"]+)"\s+TO\s+"(.*)"$/i);
    return writeFile(filename, content);
  }

  if (/^UPDATE FILE\s+"[^"]+"\s+ADD\s+".*"$/i.test(trimmed)) {
    const [, filename, content] = trimmed.match(/^UPDATE FILE\s+"([^"]+)"\s+ADD\s+"(.*)"$/i);
    return appendFile(filename, content);
  }

  if (/^DELETE FILE\s+"[^"]+"$/i.test(trimmed)) {
    const filename = trimmed.match(/^DELETE FILE\s+"([^"]+)"$/i)[1];
    return deleteFile(filename);
  }

  // Obsługuje komendy CREATE FOLDER, DELETE FOLDER, USE, DROP, etc.
  if (/^CREATE FOLDER\s+"[^"]+"$/i.test(trimmed)) {
    const foldername = trimmed.match(/^CREATE FOLDER\s+"([^"]+)"$/i)[1];
    return createFolder(foldername);
  }

  if (/^DELETE FOLDER\s+"[^"]+"$/i.test(trimmed)) {
    const foldername = trimmed.match(/^DELETE FOLDER\s+"([^"]+)"$/i)[1];
    return deleteFolder(foldername);
  }

  if (/^USE\s+"[^"]+"$/i.test(trimmed)) {
    const foldername = trimmed.match(/^USE\s+"([^"]+)"$/i)[1];
    return useFolder(foldername);
  }

  if (/^DROP$/i.test(trimmed)) {
    return dropFolder();
  }

  // Obsługuje komendy LIST FILE, LIST FOLDER, LIST *, etc.
  if (/^LIST FILE$/i.test(trimmed)) {
    return listFiles();
  }

  if (/^LIST FOLDER$/i.test(trimmed)) {
    return listFolders();
  }

  if (/^LIST\s+\*$/i.test(trimmed)) return listAll();

  // Obsługuje komendy MOVE FILE, MOVE FOLDER, COPY FILE, COPY FOLDER, etc.
  if (/^MOVE FILE\s+"(\*|[^"]+)"\s+TO\s+"([^"]+)"$/i.test(trimmed)) {
    const [, source, target] = trimmed.match(/^MOVE FILE\s+"([^"]+)"\s+TO\s+"([^"]+)"$/i);
    if (source === '*') {
      getAllFiles().forEach(f => moveItem('FILE', f, target));
    } else {
      return moveItem('FILE', source, target);
    }
    return;
  }

  if (/^MOVE FILES(?: FROM "([^"]+)")?(?: WHERE (.+))? TO "([^"]+)"$/i.test(trimmed)) {
    const [, fromPath, whereClause, target] = trimmed.match(/^MOVE FILES(?: FROM "([^"]+)")?(?: WHERE (.+))? TO "([^"]+)"$/i);
    return advancedMoveFiles({ fromPath, whereClause, target });
  }

  if (/^MOVE FOLDER\s+"(\*|[^"]+)"\s+TO\s+"([^"]+)"$/i.test(trimmed)) {
    const [, source, target] = trimmed.match(/^MOVE FOLDER\s+"([^"]+)"\s+TO\s+"([^"]+)"$/i);
    if (source === '*') {
      getAllFolders().forEach(f => moveItem('FOLDER', f, target));
    } else {
      return moveItem('FOLDER', source, target);
    }
    return;
  }

  if (/^MOVE FOLDERS(?: FROM "([^"]+)")?(?: WHERE (.+))? TO "([^"]+)"$/i.test(trimmed)) {
    const [, fromPath, whereClause, target] = trimmed.match(/^MOVE FOLDERS(?: FROM "([^"]+)")?(?: WHERE (.+))? TO "([^"]+)"$/i);
    return advancedMoveFolders({ fromPath, whereClause, target });
  }

  if (/^COPY FILE\s+"(\*|[^"]+)"\s+TO\s+"([^"]+)"$/i.test(trimmed)) {
    const [, source, target] = trimmed.match(/^COPY FILE\s+"([^"]+)"\s+TO\s+"([^"]+)"$/i);
    if (source === '*') getAllFiles().forEach(f => copyItem('FILE', f, target));
    else return copyItem('FILE', source, target);
    return;
  }

  if (/^COPY FILES(?: FROM "([^"]+)")?(?: WHERE (.+))? TO "([^"]+)"$/i.test(trimmed)) {
    const [, fromPath, whereClause, target] = trimmed.match(/^COPY FILES(?: FROM "([^"]+)")?(?: WHERE (.+))? TO "([^"]+)"$/i);
    return advancedCopyFiles({ fromPath, whereClause, target });
  }

  if (/^COPY FOLDER\s+"(\*|[^"]+)"\s+TO\s+"([^"]+)"$/i.test(trimmed)) {
    const [, source, target] = trimmed.match(/^COPY FOLDER\s+"([^"]+)"\s+TO\s+"([^"]+)"$/i);
    if (source === '*') getAllFolders().forEach(f => copyItem('FOLDER', f, target));
    else return copyItem('FOLDER', source, target);
    
    return;
  }

  if (/^COPY FOLDERS(?: FROM "([^"]+)")?(?: WHERE (.+))? TO "([^"]+)"$/i.test(trimmed)) {
    const [, fromPath, whereClause, target] = trimmed.match(/^COPY FOLDERS(?: FROM "([^"]+)")?(?: WHERE (.+))? TO "([^"]+)"$/i);
    return advancedCopyFolders({ fromPath, whereClause, target });
  }

  // Obsługuje komendy RENAME FILE, RENAME FOLDER, COUNT FILES, COUNT FOLDERS, etc.
  if (/^RENAME FILE\s+"(.+?)"\s+TO\s+"(.+?)"$/i.test(trimmed)) {
    const [, oldName, newName] = trimmed.match(/^RENAME FILE\s+"(.+?)"\s+TO\s+"(.+?)"$/i);
    return renameItem(oldName, newName);
  }

  if (/^RENAME FOLDER\s+"(.+?)"\s+TO\s+"(.+?)"$/i.test(trimmed)) {
    const [, oldName, newName] = trimmed.match(/^RENAME FOLDER\s+"(.+?)"\s+TO\s+"(.+?)"$/i);
    return renameItem(oldName, newName);
  }

  if (/^COUNT FILES$/i.test(trimmed)) {
    return logInfo(`Plików: ${getAllFiles().length}`);
  }

  if (/^COUNT FOLDERS$/i.test(trimmed)) {
    return logInfo(`Folderów: ${getAllFolders().length}`);
  }

  if (/^COUNT ALL$/i.test(trimmed)) {
    return logInfo(`Wszystkich elementów: ${getAllItems().length}`);
  }

  // Obsługuje komendy SELECT FILES, SELECT FOLDERS, MERGE, etc.
  if (/^SELECT FILES(?: FROM "([^"]+)")?(?: WHERE (.+?))?(?: ORDER BY (.+?))?(?: INTO "(.+?)")?$/i.test(trimmed)) {
    const [, fromPath, whereClause, orderBy, outputFile] = trimmed.match(
      /^SELECT FILES(?: FROM "([^"]+)")?(?: WHERE (.+?))?(?: ORDER BY (.+?))?(?: INTO "(.+?)")?$/i
    );
    return selectFiles({ fromPath, whereClause, orderBy, outputFile });
  }

  if (/^SELECT FOLDERS(?: FROM "([^"]+)")?(?: WHERE (.+?))?(?: ORDER BY (.+?))?(?: INTO "(.+?)")?$/i.test(trimmed)) {
    const [, fromPath, whereClause, orderBy, outputFile] = trimmed.match(
      /^SELECT FOLDERS(?: FROM "([^"]+)")?(?: WHERE (.+?))?(?: ORDER BY (.+?))?(?: INTO "(.+?)")?$/i
    );
    return selectFolders({ fromPath, whereClause, orderBy, outputFile });
  }

  if (/^MERGE\s+((?:"[^"]+"\s+)+)TO\s+"([^"]+)"$/i.test(trimmed)) {
    const [, sourcesStr, destination] = trimmed.match(/^MERGE\s+((?:"[^"]+"\s+)+)TO\s+"([^"]+)"$/i);
    const sourceFiles = sourcesStr.match(/"([^"]+)"/g).map(s => s.slice(1, -1));
    return mergeFiles(sourceFiles, destination);
  }

  // NEW: FILANG MULTILINES EDITOR (FMLE) - edycja pliku w trybie wieloliniowym.
  // Składnia: FMLE FILE "nazwa_pliku"
  // Podczas edycji wpisz ".exit" na osobnej linii, aby zakończyć edycję i zapisać plik.
  if (/^FMLE\s+FILE\s+"[^"]+"$/i.test(trimmed)) {
    const filename = trimmed.match(/^FMLE\s+FILE\s+"([^"]+)"$/i)[1];
    return viEditFile(filename);
  }

  console.log('[ERROR] Nieznana komenda:', command);
}

// Nowa funkcja – viEditFile; edytor w stylu vi z trybem INSERT i COMMANDLINE.
function viEditFile(filename) {
  const filePath = path.join(currentPath, filename);
  // Inicjalizacja bufora – jeśli plik istnieje, wczytaj jego zawartość, w przeciwnym razie rozpocznij od pustej linii.
  let buffer = [];
  if(fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf8");
    buffer = content.split(/\r?\n/);
  }
  if(buffer.length === 0) buffer.push("");
  let lineIndex = buffer.length - 1;          // indeks aktualnie edytowanej linii
  let cursorPos = buffer[lineIndex].length;     // pozycja kursora w tej linii
  let mode = "INSERT";                          // TRYB: "INSERT" lub "COMMAND"
  let commandBuffer = "";
  
  const termRows = process.stdout.rows || 24;
  
  // Odświeża ekran: wyświetla ostatnie linie bufora wraz z bieżącą linią (z widocznym kursorem)
  function refreshScreen() {
    console.clear();
    const start = Math.max(0, buffer.length - (termRows - 2));
    for(let i = start; i < buffer.length; i++){
      if(i === lineIndex) {
        let line = buffer[i];
        let before = line.slice(0, cursorPos);
        let after = line.slice(cursorPos);
        console.log(before + '|' + after); // '|' wskazuje pozycję kursora
      } else {
        console.log(buffer[i]);
      }
    }
    if(mode === "INSERT") {
      console.log("-- INSERT -- (ESC przełącza do COMMAND)");
    } else {
      console.log(":" + commandBuffer);
    }
  }
  
  refreshScreen();
  
  // Przełącz klawiaturę do trybu raw i nasłuchuj keypressów
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  
  function onKeypress(str, key) {
    if(mode === "INSERT") {
      if(key.name === "escape") {
        mode = "COMMAND";
        commandBuffer = "";
        refreshScreen();
        return;
      }
      if(key.name === "return") {
        // Podział bieżącej linii: tekst przed kursorem pozostaje w bieżącej linii,
        // a tekst za kursorem przenosi się do nowej linii poniżej.
        let currentLine = buffer[lineIndex];
        let before = currentLine.slice(0, cursorPos);
        let after = currentLine.slice(cursorPos);
        buffer[lineIndex] = before;
        buffer.splice(lineIndex+1, 0, after);
        lineIndex++;
        cursorPos = 0;
        refreshScreen();
        return;
      }
      if(key.name === "backspace") {
        if(cursorPos > 0) {
          buffer[lineIndex] = buffer[lineIndex].slice(0, cursorPos - 1) + buffer[lineIndex].slice(cursorPos);
          cursorPos--;
        } else if(cursorPos === 0 && lineIndex > 0) {
          // Łączymy bieżącą linię z poprzednią
          let prevLine = buffer[lineIndex - 1];
          cursorPos = prevLine.length;
          buffer[lineIndex - 1] = prevLine + buffer[lineIndex];
          buffer.splice(lineIndex, 1);
          lineIndex--;
        }
        refreshScreen();
        return;
      }
      if(key.name === "delete") {
        buffer[lineIndex] = buffer[lineIndex].slice(0, cursorPos) + buffer[lineIndex].slice(cursorPos + 1);
        refreshScreen();
        return;
      }
      if(key.name === "left") {
        if(cursorPos > 0) cursorPos--;
        refreshScreen();
        return;
      }
      if(key.name === "right") {
        if(cursorPos < buffer[lineIndex].length) cursorPos++;
        refreshScreen();
        return;
      }
      if(key.name === "up") {
        if(lineIndex > 0) {
          lineIndex--;
          cursorPos = Math.min(cursorPos, buffer[lineIndex].length);
        }
        refreshScreen();
        return;
      }
      if(key.name === "down") {
        if(lineIndex < buffer.length - 1) {
          lineIndex++;
          cursorPos = Math.min(cursorPos, buffer[lineIndex].length);
        }
        refreshScreen();
        return;
      }
      // Wstawianie zwykłych znaków
      if(str && str.length === 1) {
        buffer[lineIndex] = buffer[lineIndex].slice(0, cursorPos) + str + buffer[lineIndex].slice(cursorPos);
        cursorPos++;
        refreshScreen();
      }
    } else { // Tryb COMMAND
      if(key.name === "escape") {
        mode = "INSERT";
        refreshScreen();
        return;
      }
      if(key.name === "return") {
        executeCommand(commandBuffer.trim());
        return;
      }
      if(key.name === "backspace") {
        commandBuffer = commandBuffer.slice(0, -1);
        refreshScreen();
        return;
      }
      if(str && str.length === 1) {
        commandBuffer += str;
        refreshScreen();
      }
    }
  }
  
  function executeCommand(cmd) {
    if(cmd === "save") {
      fs.writeFileSync(filePath, buffer.join(os.EOL));
      logSuccess(`Plik "${filename}" zapisany.`);
      cleanup();
    } else if(cmd === "exit") {
      logInfo(`Wyjście z edytora bez zapisu.`);
      cleanup();
    } else if(cmd.startsWith("load")) {
      // Polecenie: :load <nazwa_pliku>
      const parts = cmd.split(/\s+/);
      if(parts.length === 2) {
        const loadFile = parts[1];
        const loadPath = path.join(currentPath, loadFile);
        if(fs.existsSync(loadPath)) {
          const content = fs.readFileSync(loadPath, "utf8");
          buffer = content.split(/\r?\n/);
          lineIndex = buffer.length - 1;
          cursorPos = buffer[lineIndex].length;
          logInfo(`Plik "${loadFile}" załadowany.`);
        } else {
          logWarning(`Plik "${loadFile}" nie istnieje.`);
        }
      } else {
        logWarning("Użycie: :load <nazwa_pliku>");
      }
      mode = "INSERT";
      refreshScreen();
    } else {
      logWarning(`Nieznana komenda: ${cmd}`);
      mode = "INSERT";
      refreshScreen();
    }
  }
  
  function cleanup() {
    process.stdin.removeListener("keypress", onKeypress);
    process.stdin.setRawMode(false);
    updatePrompt();
  }
  
  process.stdin.on("keypress", onKeypress);
}

// Funkcje obsługujące komendy
function loadFQL(filename) {
  const filePath = path.join(currentPath, filename);
  if (!fs.existsSync(filePath)) {
    return logError(`Plik "${filename}" nie istnieje.`);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine === '' || trimmedLine.startsWith('//')) return;
    logInfo(`Wykonywanie komendy: ${trimmedLine}`);
    interpret(trimmedLine);
  });
}

function chmodItem(name, mode) {
  const itemPath = path.join(currentPath, name);
  if (!fs.existsSync(itemPath)) {
    return console.log(`[ERROR] Obiekt "${name}" nie istnieje.`);
  }

  try {
    fs.chmodSync(itemPath, parseInt(mode, 8));
    console.log(`[SUCCESS] Uprawnienia "${name}" zmienione na ${mode}.`);
  } catch (err) {
    console.log(`[ERROR] Nie udało się zmienić uprawnień: ${err.message}`);
  }
}

function createFile(filename) {
  const filePath = path.join(currentPath, filename);
  if (fs.existsSync(filePath)) return logWarning(`Plik "${filename}" już istnieje.`);
  fs.writeFileSync(filePath, '');
  logSuccess(`Plik "${filename}" został utworzony.`);
}

function readFile(filename) {
  const filePath = path.join(currentPath, filename);
  if (!fs.existsSync(filePath)) return logError(`Plik "${filename}" nie istnieje.`);
  const content = fs.readFileSync(filePath, 'utf8');
  logInfo(`Zawartość "${filename}":\n${content}`);
}

function writeFile(filename, content) {
  const filePath = path.join(currentPath, filename);
  const decodedContent = decodeEscapes(content);
  fs.writeFileSync(filePath, decodedContent);
  logSuccess(`Plik "${filename}" został nadpisany.`);
}

function decodeEscapes(str) {
  try {
    return JSON.parse('"' + str.replace(/"/g, '\\"') + '"');
  } catch (error) {
    logWarning('Nie udało się dekodować escape sequence, używam oryginalnego tekstu.');
    return str;
  }
}

function appendFile(filename, content) {
  const filePath = path.join(currentPath, filename);
  fs.appendFileSync(filePath, content);
  logSuccess(`Tekst został dopisany do pliku "${filename}".`);
}

function deleteFile(filename) {
  const filePath = path.join(currentPath, filename);
  if (!fs.existsSync(filePath)) return logError(`Plik "${filename}" nie istnieje.`);
  fs.unlinkSync(filePath);
  logSuccess(`Plik "${filename}" usunięty.`);
}

function deleteFilesAdvanced({ fromPath, whereClause }) {
  const searchPath = fromPath ? path.join(currentPath, fromPath) : currentPath;
  if (fromPath && !fs.existsSync(searchPath)) {
    return logError(`Ścieżka nie istnieje: ${fromPath}`);
  }
  
  let files = fs.readdirSync(searchPath)
    .filter(f => fs.statSync(path.join(searchPath, f)).isFile())
    .map(f => ({
      name: f,
      path: path.join(searchPath, f),
      size: fs.statSync(path.join(searchPath, f)).size,
      extension: path.extname(f).toLowerCase(),
      modified: fs.statSync(path.join(searchPath, f)).mtime
    }));
    
  if (whereClause) {
    files = filterFiles(files, whereClause, searchPath);
  }
  
  files.forEach(file => {
    try {
      fs.unlinkSync(file.path);
      logSuccess(`Plik "${file.name}" usunięty.`);
    } catch (error) {
      logError(`Błąd przy usuwaniu pliku "${file.name}": ${error.message}`);
    }
  });
}

function deleteFoldersAdvanced({ fromPath, whereClause }) {
  const searchPath = fromPath ? path.join(currentPath, fromPath) : currentPath;
  if (fromPath && !fs.existsSync(searchPath)) {
    return logError(`Ścieżka nie istnieje: ${fromPath}`);
  }
  
  let folders = fs.readdirSync(searchPath)
    .filter(f => fs.statSync(path.join(searchPath, f)).isDirectory())
    .map(f => {
      const fullPath = path.join(searchPath, f);
      const stats = fs.statSync(fullPath);
      return { name: f, path: fullPath, modified: stats.mtime, size: 0, extension: "" };
    });
    
  if (whereClause) {
    folders = filterFiles(folders, whereClause, searchPath);
  }
  
  folders.forEach(folder => {
    try {
      fs.rmSync(folder.path, { recursive: true, force: true });
      logSuccess(`Folder "${folder.name}" usunięty.`);
    } catch (error) {
      logError(`Błąd przy usuwaniu folderu "${folder.name}": ${error.message}`);
    }
  });
}

function createFolder(foldername) {
  const folderPath = path.join(currentPath, foldername);
  if (fs.existsSync(folderPath)) return logWarning(`Folder "${foldername}" już istnieje.`);
  fs.mkdirSync(folderPath);
  logSuccess(`Folder "${foldername}" został utworzony.`);
}

function deleteFolder(foldername) {
  const folderPath = path.join(currentPath, foldername);
  if (!fs.existsSync(folderPath)) return logError(`Folder "${foldername}" nie istnieje.`);
  fs.rmSync(folderPath, { recursive: true, force: true });
  logSuccess(`Folder "${foldername}" usunięty.`);
}

function useFolder(foldername) {
  const target = path.join(currentPath, foldername);
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) return logError(`Brak folderu "${foldername}"`);
  currentPath = target;
  updatePrompt();
  logInfo(`Zmieniono katalog roboczy na "${foldername}".`);
}

function dropFolder() {
  const parent = path.dirname(currentPath);
  if (parent === currentPath) return logError("Już jesteś w katalogu głównym.");
  currentPath = parent;
  updatePrompt();
  logInfo(`Przeniesiono się do katalogu nadrzędnego.`);
}

function moveItem(type, source, target) {
  const src = path.join(currentPath, source);
  const dst = path.join(currentPath, target, path.basename(source));
  if (!fs.existsSync(src)) return logError(`${type} "${source}" nie istnieje.`);
  fs.renameSync(src, dst);
  logSuccess(`${type} "${source}" przeniesiono do "${target}".`);
}

function advancedMoveFiles({ fromPath, whereClause, target }) {
  const searchPath = fromPath ? path.join(currentPath, fromPath) : currentPath;
  if (fromPath && !fs.existsSync(searchPath)) {
    return logError(`Ścieżka nie istnieje: ${fromPath}`);
  }
  
  let files = fs.readdirSync(searchPath)
    .filter(f => fs.statSync(path.join(searchPath, f)).isFile())
    .map(f => {
      const fullPath = path.join(searchPath, f);
      const stats = fs.statSync(fullPath);
      return { name: f, path: fullPath, size: stats.size, extension: path.extname(f).toLowerCase(), modified: stats.mtime };
    });
    
  if (whereClause) {
    files = filterFiles(files, whereClause, searchPath);
  }
  
  files.forEach(file => {
    const dst = path.join(currentPath, target, file.name);
    try {
      fs.renameSync(file.path, dst);
      logSuccess(`Plik "${file.name}" przeniesiony do "${target}".`);
    } catch (error) {
      logError(`Błąd przenoszenia pliku "${file.name}": ${error.message}`);
    }
  });
}

function advancedMoveFolders({ fromPath, whereClause, target }) {
  const searchPath = fromPath ? path.join(currentPath, fromPath) : currentPath;
  if (fromPath && !fs.existsSync(searchPath)) {
    return logError(`Ścieżka nie istnieje: ${fromPath}`);
  }
  
  let folders = fs.readdirSync(searchPath)
    .filter(f => fs.statSync(path.join(searchPath, f)).isDirectory())
    .map(f => {
      const fullPath = path.join(searchPath, f);
      const stats = fs.statSync(fullPath);
      return { name: f, path: fullPath, modified: stats.mtime, size: 0, extension: "" };
    });
    
  if (whereClause) {
    folders = filterFiles(folders, whereClause, searchPath);
  }
  
  folders.forEach(folder => {
    const dst = path.join(currentPath, target, folder.name);
    try {
      fs.renameSync(folder.path, dst);
      logSuccess(`Folder "${folder.name}" przeniesiony do "${target}".`);
    } catch (error) {
      logError(`Błąd przenoszenia folderu "${folder.name}": ${error.message}`);
    }
  });
}

function copyItem(type, source, target) {
  const src = path.join(currentPath, source);
  const dst = path.join(currentPath, target, path.basename(source));
  if (!fs.existsSync(src)) return logError(`${type} "${source}" nie istnieje.`);

  if (fs.statSync(src).isDirectory()) {
    copyFolderRecursive(src, dst);
  } else {
    fs.copyFileSync(src, dst);
  }

  logSuccess(`${type} "${source}" skopiowano do "${target}".`);
}

function advancedCopyFiles({ fromPath, whereClause, target }) {
  const searchPath = fromPath ? path.join(currentPath, fromPath) : currentPath;
  if (fromPath && !fs.existsSync(searchPath)) {
    return logError(`Ścieżka nie istnieje: ${fromPath}`);
  }
  
  let files = fs.readdirSync(searchPath)
    .filter(f => fs.statSync(path.join(searchPath, f)).isFile())
    .map(f => {
      const fullPath = path.join(searchPath, f);
      const stats = fs.statSync(fullPath);
      return { name: f, path: fullPath, size: stats.size, extension: path.extname(f).toLowerCase(), modified: stats.mtime };
    });
    
  if (whereClause) {
    files = filterFiles(files, whereClause, searchPath);
  }
  
  files.forEach(file => {
    const dst = path.join(currentPath, target, file.name);
    try {
      fs.copyFileSync(file.path, dst);
      logSuccess(`Plik "${file.name}" skopiowany do "${target}".`);
    } catch (error) {
      logError(`Błąd kopiowania pliku "${file.name}": ${error.message}`);
    }
  });
}

function advancedCopyFolders({ fromPath, whereClause, target }) {
  const searchPath = fromPath ? path.join(currentPath, fromPath) : currentPath;
  if (fromPath && !fs.existsSync(searchPath)) {
    return logError(`Ścieżka nie istnieje: ${fromPath}`);
  }
  
  let folders = fs.readdirSync(searchPath)
    .filter(f => fs.statSync(path.join(searchPath, f)).isDirectory())
    .map(f => {
      const fullPath = path.join(searchPath, f);
      const stats = fs.statSync(fullPath);
      return { name: f, path: fullPath, modified: stats.mtime, size: 0, extension: "" };
    });
    
  if (whereClause) {
    folders = filterFiles(folders, whereClause, searchPath);
  }
  
  folders.forEach(folder => {
    const dst = path.join(currentPath, target, folder.name);
    try {
      copyFolderRecursive(folder.path, dst);
      logSuccess(`Folder "${folder.name}" skopiowany do "${target}".`);
    } catch (error) {
      logError(`Błąd kopiowania folderu "${folder.name}": ${error.message}`);
    }
  });
}

function copyFolderRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcEntry = path.join(src, entry.name);
    const destEntry = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyFolderRecursive(srcEntry, destEntry);
    } else {
      fs.copyFileSync(srcEntry, destEntry);
    }
  }
}

function listFiles() {
  const files = getAllFiles();
  if (files.length === 0) return logInfo('Brak plików w katalogu.');

  files.forEach(name => {
    const full = path.join(currentPath, name);
    const stats = fs.statSync(full);
    const perms = formatPermissions(stats.mode);
    const size = stats.size.toString().padStart(6);
    const date = stats.mtime.toISOString();
    console.log(`${perms} FILE ${size}B  ${date}  ${name}`);
  });
}

function listFolders() {
  const folders = getAllFolders();
  if (folders.length === 0) return logInfo('Brak folderów w katalogu.');

  folders.forEach(name => {
    const full = path.join(currentPath, name);
    const stats = fs.statSync(full);
    const perms = formatPermissions(stats.mode);
    const date = stats.mtime.toISOString();
    console.log(`${perms} FOLDER      ${date} ${name}`);
  });
}

function listAll() {
  const items = getAllItems();
  if (items.length === 0) return logInfo('Brak plików i folderów w katalogu.');

  items.forEach(name => {
    const full = path.join(currentPath, name);
    const stats = fs.statSync(full);
    const perms = formatPermissions(stats.mode);
    const date = stats.mtime.toISOString();
    if (stats.isDirectory()) {
      console.log(`${perms} FOLDER           ${date} ${name}`);
    } else {
      const size = stats.size.toString().padStart(6);
      console.log(`${perms} FILE   ${size}B ${date} ${name}`);
    }
  });
}

function renameItem(oldName, newName) {
  const oldPath = path.join(currentPath, oldName);
  const newPath = path.join(currentPath, newName);
  if (!fs.existsSync(oldPath)) return logError(`Nie znaleziono: ${oldName}`);
  fs.renameSync(oldPath, newPath);
  logSuccess(`Zmieniono nazwę z "${oldName}" na "${newName}".`);
}

function formatPermissions(mode) {
  return (mode & 0o777).toString(8).padStart(4, '0');
}

function selectFiles({ fromPath, whereClause, orderBy, outputFile }) {
  try {
    const searchPath = fromPath ? path.join(currentPath, fromPath) : currentPath;
    
    if (fromPath && !fs.existsSync(searchPath)) {
      logError(`Ścieżka nie istnieje: ${fromPath}`);
      return;
    }

    const files = fs.readdirSync(searchPath)
      .filter(f => fs.statSync(path.join(searchPath, f)).isFile())
      .map(file => {
        const fullPath = path.join(searchPath, file);
        const stats = fs.statSync(fullPath);
        return {
          name: file,
          path: fullPath,
          size: stats.size,
          extension: path.extname(file).toLowerCase(),
          modified: stats.mtime,
          created: stats.birthtime,
          permissions: (stats.mode & 0o777).toString(8)
        };
      });

    let results = whereClause ? filterFiles(files, whereClause, searchPath) : files;

    if (orderBy) {
      const [field, direction] = orderBy.split(/\s+/);
      results.sort((a, b) => {
        const valA = a[field.toLowerCase()];
        const valB = b[field.toLowerCase()];
        return (direction === 'DESC' ? -1 : 1) * (valA > valB ? 1 : -1);
      });
    }

    if (outputFile) {
      saveResults(results, outputFile);
      logSuccess(`Wyniki zapisano do: ${outputFile}`);
    } else {
      displayResults(results);
    }

  } catch (error) {
    logError(`Błąd SELECT: ${error.message}`);
  }
}

function selectFolders({ fromPath, whereClause, orderBy, outputFile }) {
  try {
    const searchPath = fromPath ? path.join(currentPath, fromPath) : currentPath;
    
    if (fromPath && !fs.existsSync(searchPath)) {
      logError(`Ścieżka nie istnieje: ${fromPath}`);
      return;
    }
    
    let folders = fs.readdirSync(searchPath)
      .filter(f => fs.statSync(path.join(searchPath, f)).isDirectory())
      .map(folder => {
        const fullPath = path.join(searchPath, folder);
        const stats = fs.statSync(fullPath);
        return {
          name: folder,
          path: fullPath,
          modified: stats.mtime,
          size: 0,
          extension: ''
        };
      });
      
    if (whereClause) {
      folders = filterFiles(folders, whereClause, searchPath);
    }
    
    if (orderBy) {
      const [field, direction] = orderBy.split(/\s+/);
      folders.sort((a, b) => {
        const valA = a[field.toLowerCase()];
        const valB = b[field.toLowerCase()];
        return (direction === 'DESC' ? -1 : 1) * (valA > valB ? 1 : -1);
      });
    }
    
    if (outputFile) {
      saveResults(folders, outputFile);
      logSuccess(`Wynik SELECT FOLDERS zapisano do: ${outputFile}`);
    } else {
      displayResults(folders);
    }
    
  } catch (error) {
    logError(`Błąd SELECT FOLDERS: ${error.message}`);
  }
}

function saveResults(files, outputPath) {
  const fullPath = path.join(currentPath, outputPath);
  const ext = path.extname(outputPath).toLowerCase();

  if (ext === '.json') {
    fs.writeFileSync(fullPath, JSON.stringify(files, null, 2));
  }
  else if (ext === '.csv') {
    const csvHeader = Object.keys(files[0]).join(',');
    const csvRows = files.map(f => Object.values(f).join(','));
    fs.writeFileSync(fullPath, [csvHeader, ...csvRows].join('\n'));
  }
  else {
    const report = files.map(f =>
      `${f.name.padEnd(30)} ${f.extension.padEnd(8)} ${(f.size + ' B').padStart(10)} ${f.modified.toISOString()}`
    ).join('\n');
    fs.writeFileSync(fullPath, `Raport wyszukiwania:\n${report}`);
  }
}

function displayResults(files) {
  if (files.length === 0) {
    logInfo('Brak wyników.');
    return;
  }

  console.log('\n' + '-'.repeat(80));
  console.log('WYNIKI WYSZUKIWANIA:');

  const displayData = files.map(f => ({
    Nazwa: f.name,
    Rozmiar: `${(f.size / 1024).toFixed(2)} KB`,
    Rozszerzenie: f.extension || '(brak)',
    Modyfikacja: f.modified.toISOString().split('T')[0]
  }));

  console.table(displayData);
  console.log(`Znaleziono ${files.length} plików.`);
}

function mergeFiles(sourceFiles, destination) {
  let mergedContent = '';
  sourceFiles.forEach(file => {
    const filePath = path.join(currentPath, file);
    if (!fs.existsSync(filePath)) {
      logWarning(`Plik "${file}" nie istnieje, pomijam.`);
      return;
    }
    try {
      mergedContent += fs.readFileSync(filePath, 'utf8') + os.EOL;
    } catch (err) {
      logError(`Błąd odczytu pliku "${file}": ${err.message}`);
    }
  });
  writeFile(destination, mergedContent);
  logSuccess(`Połączono pliki do "${destination}".`);
}

function filterFiles(files, conditions, searchPath = currentPath) {
  if (!conditions) return files;

  const orGroups = splitOrConditions(conditions);

  return files.filter(file => {
    return orGroups.some(group => {
      return group.every(cond => {
        try {
          return evaluateCondition(file, cond.trim());
        } catch (error) {
          logError(`Błąd warunku '${cond}': ${error.message}`);
          return false;
        }
      });
    });
  });
}

function splitOrConditions(conditions) {
  const groups = [];
  let currentGroup = [];
  let inParentheses = false;
  let buffer = '';
  
  for (const token of conditions.split(/\s+/)) {
    if (token === 'OR' && !inParentheses) {
      if (buffer.trim()) currentGroup.push(buffer.trim());
      groups.push(currentGroup);
      currentGroup = [];
      buffer = '';
    } else {
      if (token.includes('(')) inParentheses = true;
      if (token.includes(')')) inParentheses = false;
      buffer += ' ' + token;
    }
  }
  
  if (buffer.trim()) currentGroup.push(buffer.trim());
  if (currentGroup.length) groups.push(currentGroup);
  
  return groups.length ? groups : [conditions.split(' AND ')];
}

function evaluateCondition(file, cond) {
  if (/name\s+LIKE\s+/i.test(cond)) {
    const pattern = cond.split('LIKE')[1].trim().replace(/^["']|["']$/g, '');
    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
    return regex.test(file.name);
  }

  else if (/extension\s*(!?=)\s*/i.test(cond)) {
    const match = cond.match(/extension\s*(!?=)\s*"([^"]+)"/i);
    if (!match) return false;
    const [_, operator, ext] = match;
    const normalizedExt = ext.toLowerCase().startsWith('.') 
      ? ext.toLowerCase() 
      : `.${ext.toLowerCase()}`;
    
    return operator === '!='
      ? file.extension !== normalizedExt
      : file.extension === normalizedExt;
  }

  else if (/size\s*([<>!]?=)\s*/i.test(cond)) {
    const match = cond.match(/size\s*([<>!]?=)\s*(\d+)/i);
    if (!match) return false;
    const [_, operator, valueStr] = match;
    const value = parseInt(valueStr);
    
    switch (operator) {
      case '>': return file.size > value;
      case '<': return file.size < value;
      case '!=': return file.size !== value;
      case '=': return file.size === value;
      default: return false;
    }
  }

  else if (/content\s+LIKE\s+/i.test(cond)) {
    if (file.size > 10 * 1024 * 1024) return false;
    const pattern = cond.split('LIKE')[1].trim().replace(/^["']|["']$/g, '');
    const regex = new RegExp(pattern.replace(/%/g, '.*'), 'i');
    const content = fs.readFileSync(file.path, 'utf-8');
    return regex.test(content);
  }

  else if (/modified\s*([<>!]?=)\s*/i.test(cond)) {
    const match = cond.match(/modified\s*([<>!]?=)\s*"([^"]+)"/i);
    if (!match) return false;
    const [_, operator, dateStr] = match;
    const fileDate = new Date(file.modified);
    const compareDate = new Date(dateStr);
    
    switch (operator) {
      case '>': return fileDate > compareDate;
      case '<': return fileDate < compareDate;
      case '!=': return fileDate.getTime() !== compareDate.getTime();
      case '=': return fileDate.getTime() === compareDate.getTime();
      default: return false;
    }
  }

  else if (/name\s*(!?=)\s*/i.test(cond)) {
    const match = cond.match(/name\s*(!?=)\s*"([^"]+)"/i);
    if (!match) return false;
    const [_, operator, name] = match;
    
    return operator === '!='
      ? file.name !== name
      : file.name === name;
  }

  else if (cond.startsWith('(') && cond.endsWith(')')) {
    return filterFiles([file], cond.slice(1, -1)).length > 0;
  }

  return false
}

// Inicjalizacja interpretera
console.log('FILANG (FILE INTERPRETER LANGUAGE) by KamilMalicki\nGithub: https://www.github.com/KamilMalicki\n');
updatePrompt();

rl.on('line', (line) => {
  if (line.trim().toUpperCase() === 'EXIT' || line.trim().toUpperCase() === 'QUIT') {
    rl.close();
    return;
  }

  interpret(line);
  updatePrompt();
});

rl.on('close', () => {
  logInfo('Zamykam interpreter.');
  process.exit(0);
});