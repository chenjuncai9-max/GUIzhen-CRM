export const exportToCSV = (data: any[], headers: { key: string; label: string }[], filename: string) => {
  if (!data || !data.length) {
    alert('暂无数据可导出');
    return;
  }

  const csvRows = [];
  
  // Add Header Row
  const headerRow = headers.map(h => h.label).join(',');
  csvRows.push(headerRow);

  // Add Data Rows
  for (const row of data) {
    const values = headers.map(header => {
      // Handle nested properties or custom formatting if needed, currently flat mapping
      let val = row[header.key];
      
      // Special handling for specific types can be done here or pre-processed before passing to this function
      if (val === undefined || val === null) val = '';
      
      // Escape quotes and wrap in quotes to handle commas/newlines in data
      const escaped = ('' + val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  // Add BOM for Excel to recognize Chinese characters correctly
  const csvString = '\ufeff' + csvRows.join('\n'); 
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const parseCSV = (csvText: string): any[] => {
  // 1. Remove BOM (Byte Order Mark) if present, critical for Excel CSVs
  const cleanText = csvText.replace(/^\ufeff/, '');
  
  const lines = cleanText.split(/\r\n|\n/);
  const result: any[] = [];
  
  // Need at least headers and one line
  if (lines.length < 2) return [];

  // 2. Clean headers (remove extra quotes and whitespace)
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values: string[] = [];
    let currentVal = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          currentVal += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(currentVal);
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal);

    const obj: any = {};
    // Map values to headers
    headers.forEach((h, idx) => {
      // Clean quotes from value if present
      let val = values[idx]?.trim() || '';
      if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
      }
      val = val.replace(/""/g, '"');
      obj[h] = val;
    });
    
    // Only push if object is not effectively empty
    if (Object.keys(obj).length > 0) {
        result.push(obj);
    }
  }
  return result;
};