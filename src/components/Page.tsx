import React from 'react';
import { Button, Col, Container, Nav, Navbar, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import useLNC from '../hooks/useLNC';
import zeus from '../zeus-logo.svg';

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
                    <Navbar.Text>by</Navbar.Text>
                    <a href="http://zeusln.app" target="_blank">
                        <img
                            alt="Zeus"
                            src={zeus}
                            width="70"
                            className="d-inline-block"
                            style={{ marginLeft: 15 }}
                        />{' '}
                    </a>
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
