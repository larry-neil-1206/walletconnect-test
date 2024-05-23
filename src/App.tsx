import React, { useEffect, useState } from 'react';
import { ClientContextProvider, useWalletConnectClient } from './contexts/ClientContext';
import TestComponent from './components/TestComponent';

function App() {

  return (
    <ClientContextProvider>
      <TestComponent />
    </ClientContextProvider>

  );
}

export default App;
