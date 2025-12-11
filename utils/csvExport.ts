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