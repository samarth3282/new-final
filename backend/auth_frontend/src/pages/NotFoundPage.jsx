import { Link } from 'react-router-dom';
import { authConfig } from '../config/authConfig';

export const NotFoundPage = () => {
    return (
        <div className="not-found">
            <p className="eyebrow">404</p>
            <h1>Route Not Found</h1>
            <p>This auth module route does not exist in the current configuration.</p>
            <Link to={authConfig.routes.login}>Go to Sign In</Link>
        </div>
    );
};
