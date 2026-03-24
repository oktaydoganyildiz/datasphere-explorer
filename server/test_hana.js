const hana = require('@sap/hana-client');

const config = {
  host: '14472cad-a059-4b64-9758-917bac31a7c0.hna0.prod-eu10.hanacloud.ondemand.com',
  port: '443',
  user: 'FAIR_TRAINING#DB_USER',
  password: ')/RoGl%[j9gc%EP1XXMRk&$2$G%1|n-v'
};

const connParams = {
  serverNode: `${config.host}:${config.port}`,
  uid: config.user,
  pwd: config.password,
  encrypt: 'true',
  sslValidateCertificate: 'false',
  connectTimeout: 10000
};

console.log('Attempting to connect to HANA Cloud...');
console.log('Host:', config.host);
console.log('Port:', config.port);
console.log('User:', config.user);

const connection = hana.createConnection();

connection.connect(connParams, (err) => {
  if (err) {
    console.error('HANA Connection Error (Full):', JSON.stringify(err, null, 2));
    console.error('Error Code:', err.code);
    console.error('Error Message:', err.message);
    process.exit(1);
  } else {
    console.log('Successfully connected to HANA Cloud!');
    connection.disconnect(() => {
      console.log('Disconnected.');
      process.exit(0);
    });
  }
});
