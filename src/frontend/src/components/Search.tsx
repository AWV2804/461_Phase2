// src/frontend/src/components/Search.tsx
import React, { useState, useContext } from 'react';
import { AuthContext } from '../AuthContext.js';
import './Styling/Search.css';

interface Package {
    Name: string;
    Version: string;
    ID: string;
}

/**
 * Search component allows users to search for packages by name or regular expression.
 * It fetches data from the backend and displays the results in a table.
 * Users can load more results if available.
 *
 * @component
 * @example
 * return (
 *   <Search />
 * )
 *
 * @returns {JSX.Element} The rendered search component.
 *
 * @typedef {Object} Package
 * @property {string} Name - The name of the package.
 * @property {string} Version - The version of the package.
 * @property {string} ID - The unique identifier of the package.
 *
 * @function constructBackendUrl
 * @param {string} path - The path to append to the backend URL.
 * @returns {string} The constructed backend URL.
 *
 * @function handleSearch
 * @param {React.FormEvent} e - The form submission event.
 * @returns {Promise<void>} Initiates a search request to the backend.
 *
 * @function loadMore
 * @returns {Promise<void>} Loads more search results from the backend.
 */
const Search: React.FC = () => {
    const { x_authorization } = useContext(AuthContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [offset, setOffset] = useState<string | null>(null);
    const [useRegex, setUseRegex] = useState(false);

    const constructBackendUrl = (path: string): string => {
        const { protocol, hostname } = window.location;
        return `${protocol}//${hostname}:${process.env.REACT_APP_BACKEND_PORT}${path}`;
    };

    const searchUrl = useRegex ? constructBackendUrl('/package/byRegEx') : constructBackendUrl('/packages');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setPackages([]);
        setOffset(null);

        try {
            let response: Response;

            if (useRegex) {
                const regexQuery = { RegEx: searchTerm };
                response = await fetch(searchUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Authorization': x_authorization || '',
                    },
                    body: JSON.stringify(regexQuery),
                });
            } else {
                const packageQueries = [
                    {
                        Name: searchTerm.trim() === '' ? '*' : searchTerm,
                        Version: '',
                    },
                ];
                response = await fetch(`${searchUrl}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Authorization': x_authorization || '',
                    },
                    body: JSON.stringify(packageQueries),
                });
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to fetch packages.');
            }

            const data: Package[] = await response.json();
            const responseOffset = response.headers.get('offset');

            setPackages(data);
            setOffset(responseOffset);
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const loadMore = async () => {
        if (!offset) return;
        setLoading(true);
        setError(null);

        try {
            let response: Response;

            if (useRegex) {
                const regexQuery = { RegEx: searchTerm };
                response = await fetch(`${searchUrl}?offset=${offset}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Authorization': x_authorization || '',
                    },
                    body: JSON.stringify(regexQuery),
                });
            } else {
                const packageQueries = [
                    {
                        Name: searchTerm.trim() === '' ? '*' : searchTerm,
                        Version: '',
                    },
                ];
                response = await fetch(`${searchUrl}?offset=${offset}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Authorization': x_authorization || '',
                    },
                    body: JSON.stringify(packageQueries),
                });
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to load more packages.');
            }

            const data: Package[] = await response.json();
            const responseOffset = response.headers.get('offset');

            setPackages((prev) => [...prev, ...data]);
            setOffset(responseOffset);
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="search-container">
            <h2>Search Packages</h2>
            <form onSubmit={handleSearch} className="search-form">
                <div className="form-group">
                    <label>
                        Package Name or Regex:
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Enter package name or regex"
                            required
                        />
                    </label>
                </div>
                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            checked={useRegex}
                            onChange={(e) => setUseRegex(e.target.checked)}
                        />
                        Use Regular Expression
                    </label>
                </div>
                <button type="submit" disabled={loading} className="search-button">
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </form>
            {error && <div className="error-message">{error}</div>}
            <div className="result-container">
                {packages.length > 0 && (
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Version</th>
                                <th>ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            {packages.map((pkg) => (
                                <tr key={pkg.ID}>
                                    <td>{pkg.Name}</td>
                                    <td>{pkg.Version}</td>
                                    <td>{pkg.ID}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {offset && (
                    <button onClick={loadMore} disabled={loading} className="load-more-button">
                        {loading ? 'Loading...' : 'Load More'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default Search;