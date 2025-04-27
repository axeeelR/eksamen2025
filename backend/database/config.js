const matti = {
  passwordConfig: {
    user: 'mathiasnygaard', 
    password: 'mathias12345!', 
    server: 'mattyserver.database.windows.net', 
    database: 'MattyDB',
    options: {
      encrypt: true,
      enableArithAbort: true
    }
  },
};

const axel = {
  passwordConfig: {
    user: 'axelovesen', 
    password: 'Axel1104', 
    server: 'axelovesen.database.windows.net', 
    database: 'Eksamen2025',
    options: {
      encrypt: true,
      enableArithAbort: true
    }
  },
};

module.exports = {axel, matti}


