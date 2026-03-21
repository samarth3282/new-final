export const FormField = ({
    id,
    label,
    type = 'text',
    placeholder,
    value,
    onChange,
    autoComplete,
    required = true
}) => {
    return (
        <label className="form-field" htmlFor={id}>
            <span>{label}</span>
            <input
                id={id}
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                autoComplete={autoComplete}
                required={required}
            />
        </label>
    );
};
