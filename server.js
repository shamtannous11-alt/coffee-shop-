const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const BASE_DIR = __dirname;
const ORDERS_FILE = path.join(BASE_DIR, 'orders.json');

if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, '[]', 'utf8');
}

function send(res, statusCode, data, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(data);
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
  };
  return types[ext] || 'application/octet-stream';
}

function readOrders() {
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch (error) {
    return [];
  }
}

function writeOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    return send(res, 204, '');
  }

  if (req.method === 'GET' && url.pathname === '/api/orders') {
    const orders = readOrders();
    return send(res, 200, JSON.stringify(orders), 'application/json; charset=utf-8');
  }

  if (req.method === 'POST' && url.pathname === '/api/orders') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.socket.destroy();
      }
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const customerName = String(data.customerName || '').trim();
        const phone = String(data.phone || '').trim();
        const location = String(data.location || '').trim();
        const orderType = String(data.orderType || 'Takeaway').trim();
        const notes = String(data.notes || '').trim();
        const items = Array.isArray(data.items)
          ? data.items
              .filter(item => Number(item.quantity) > 0)
              .map(item => ({
                name: String(item.name || ''),
                price: Number(item.price) || 0,
                quantity: Number(item.quantity) || 0,
                total: (Number(item.price) || 0) * (Number(item.quantity) || 0)
              }))
          : [];

        if (!customerName) {
          return send(res, 400, JSON.stringify({ error: 'Customer name is required.' }), 'application/json; charset=utf-8');
        }

        if (items.length === 0) {
          return send(res, 400, JSON.stringify({ error: 'Select at least one item.' }), 'application/json; charset=utf-8');
        }

        const total = items.reduce((sum, item) => sum + item.total, 0);
        const orders = readOrders();

        const newOrder = {
          id: Date.now(),
          customerName,
          phone,
          location,
          orderType,
          notes,
          items,
          total,
          createdAt: new Date().toISOString()
        };

        orders.unshift(newOrder);
        writeOrders(orders);

        return send(
          res,
          201,
          JSON.stringify({ message: 'Order saved successfully.', order: newOrder }),
          'application/json; charset=utf-8'
        );
      } catch (error) {
        return send(res, 400, JSON.stringify({ error: 'Invalid JSON data.' }), 'application/json; charset=utf-8');
      }
    });

    return;
  }

  let filePath = path.join(BASE_DIR, url.pathname === '/' ? 'work.html' : url.pathname.replace(/^\/+/, ''));

  if (!filePath.startsWith(BASE_DIR)) {
    return send(res, 403, 'Forbidden');
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      return send(res, 404, 'File not found.');
    }
    send(res, 200, content, getMimeType(filePath));
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});