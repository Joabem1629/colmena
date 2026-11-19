'use strict';

// Error con código HTTP. El mensaje llega tal cual al navegador (nunca pongas datos internos).
const fail = (status, message) => Object.assign(new Error(message), { status });

module.exports = { fail };
