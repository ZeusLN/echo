import React from 'react';
import { Button, Col, Container, Nav, Navbar, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import useLNC from '../hooks/useLNC';

interface Props {
    children?: React.ReactNode;
}

const Page: React.FC<Props> = ({ children }) => {
    const { lnc } = useLNC();

    return (
        <>
            <Navbar bg="dark" variant="dark" expand="lg" className="mb-3">
                <Container>
                    <Link to="/" className="navbar-brand">
                        Apollo
                    </Link>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="ml-auto">
                            {lnc.isConnected ? (
                                <a href="/">
                                    <Button
                                        style={{
                                            background: 'darkred',
                                            borderWidth: 0
                                        }}
                                    >
                                        Logout
                                    </Button>
                                </a>
                            ) : lnc.credentials.isPaired ? (
                                <Link to="/login">
                                    <Button>Login</Button>
                                </Link>
                            ) : (
                                <Link to="/connect">
                                    <Button>Connect</Button>
                                </Link>
                            )}
                        </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>
            <Container>
                <Row>
                    <Col>{children}</Col>
                </Row>
            </Container>
        </>
    );
};

export default Page;
