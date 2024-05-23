import React, { Component, useEffect, useState } from 'react';
import { useWalletConnectClient } from '../contexts/ClientContext';
import withWalletConnectClient from '../hocs/WalletConnectClientHOC';
import { Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@material-ui/core';

interface TestComponentProps {
    walletConnectClient: {
        client: any;
        connect: () => void;
        pairings: any[];
    };
}

class TestComponent extends Component<any, any> {

    // const[modal, setModal] = useState("");
    // const openPairingModal = () => setModal("pairing");

    constructor(props: any) {
        super(props);
        this.state = {
            open: false,
        };
    }

    handleClickOpen = () => {
        this.setState({ open: true });
    };

    handleClose = () => {
        this.setState({ open: false });
    };

    onConnect = () => {
        const { client, connect, pairings } = this.props;


        if (typeof client === "undefined") {
            throw new Error("WalletConnect is not initialized");
        }
        // Suggest existing pairings (if any).
        // If no existing pairings are available, trigger `WalletConnectClient.connect`.
        connect();
    };


    renderContent = () => {

        return (<Button variant="outlined" color="primary" onClick={this.onConnect}>
            Connect
        </Button>)
    };
    render() {
        return (
            <div>
                {this.renderContent()}
                <Button variant="outlined" color="primary" onClick={this.handleClickOpen}>
                    Open dialog
                </Button>
                <Dialog
                    open={this.state.open}
                    onClose={this.handleClose}
                    aria-labelledby="alert-dialog-title"
                    aria-describedby="alert-dialog-description"
                >
                    <DialogTitle id="alert-dialog-title">{"Test dialog for WalletConnect"}</DialogTitle>
                    <DialogContent>
                        <DialogContentText id="alert-dialog-description">
                            Try to connect WalletConnect on this dialog
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={this.onConnect} color="primary">
                            Connect
                        </Button>
                        <Button onClick={this.handleClose} color="primary" autoFocus>
                            Close
                        </Button>
                    </DialogActions>
                </Dialog>
            </div>
        );
    }
};

export default withWalletConnectClient(TestComponent);