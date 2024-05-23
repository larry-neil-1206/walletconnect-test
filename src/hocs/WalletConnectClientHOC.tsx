import React from 'react';
import { useWalletConnectClient } from '../contexts/ClientContext';
import { JSX } from 'react/jsx-runtime';


export default function withWalletConnectClient(WrappedComponent: React.ComponentType) {
  return function WrappedWithWalletConnectClient(props: any) {
    const walletConnectClient = useWalletConnectClient();
    return <WrappedComponent {...props} {...walletConnectClient} />;
  }
}