import React from 'react';
import { useWalletConnectClient } from '../contexts/ClientContext';
import { JSX } from 'react/jsx-runtime';
// import { useConnectWithWagmi } from '../hooks/wagmi';
import { useConnect } from 'wagmi';


export default function withWalletConnectClient(WrappedComponent: React.ComponentType) {
  return function WrappedWithWalletConnectClient(props: any) {
    // const connectWithWagmi = useConnectWithWagmi(() => console.log('===> connected onSuccess function'));
    const { connectors } = useConnect()
    console.log('===> connectors', connectors)
    const uniswapConnector = connectors.find((connector) => connector.name === 'uniswapWalletConnect')
    const walletConnectClient = useWalletConnectClient();
    // return <WrappedComponent {...props} {...walletConnectClient} connectWithWagmi={connectWithWagmi} uniswapConnector={uniswapConnector} />;
    return <WrappedComponent {...props} {...walletConnectClient} />;
  }
}