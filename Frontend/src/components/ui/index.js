import React, { useMemo, useState, useEffect, useContext, createContext } from 'react';
import MuiButton from '@mui/material/Button';
import MuiCard from '@mui/material/Paper';
import MuiDivider from '@mui/material/Divider';
import MuiBadge from '@mui/material/Badge';
import MuiChip from '@mui/material/Chip';
import MuiAvatar from '@mui/material/Avatar';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

const DropdownCtx = createContext({ close: () => {} });

function radiusToPx(radius) {
  if (typeof radius === 'number') return radius;
  if (!radius) return 12;
  switch (radius) {
    case 'sm':
      return 10;
    case 'md':
      return 12;
    case 'lg':
      return 14;
    default:
      return 12;
  }
}

function colorToMUIColor(color) {
  switch (color) {
    case 'primary':
      return 'primary';
    case 'secondary':
      return 'secondary';
    case 'success':
      return 'success';
    case 'danger':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'primary';
  }
}

export function Button({
  variant = 'light',
  color = 'default',
  fullWidth,
  startContent,
  endContent,
  isIconOnly,
  size,
  onPress,
  onClick,
  children,
  style,
  className,
  disabled,
  ...rest
}) {
  const muiVariant = variant === 'solid' ? 'contained' : 'text';
  const muiColor = color === 'default' ? 'inherit' : colorToMUIColor(color);

  const sx = useMemo(() => {
    const base = {};
    if (variant === 'light') {
      base.backgroundColor = 'rgba(255,255,255,0.06)';
      base.border = '1px solid rgba(148, 163, 184, 0.25)';
    }
    if (variant === 'flat') {
      base.backgroundColor = 'transparent';
    }
    if (isIconOnly) {
      base.minWidth = 40;
      base.width = 40;
      base.height = 40;
      base.padding = 0;
    }
    if (fullWidth) base.width = '100%';
    return base;
  }, [variant, isIconOnly, fullWidth]);

  return (
    <MuiButton
      className={className}
      variant={muiVariant}
      color={muiColor}
      size={size === 'sm' ? 'small' : 'medium'}
      fullWidth={fullWidth}
      onClick={(e) => {
        if (disabled) return;
        if (onClick) onClick(e);
        else if (onPress) onPress(e);
      }}
      disabled={disabled}
      startIcon={startContent ? startContent : undefined}
      endIcon={endContent ? endContent : undefined}
      style={style}
      sx={sx}
      {...rest}
    >
      {children}
    </MuiButton>
  );
}

export function Card({ shadow = 'none', radius = 'md', className, style, children, sx: sxProp, ...rest }) {
  return (
    <MuiCard
      className={className}
      elevation={shadow === 'none' ? 0 : 3}
      sx={{
        borderRadius: `${radiusToPx(radius)}px`,
        border: '1px solid rgba(226,232,240,0.9)',
        ...(sxProp || {})
      }}
      style={style}
      {...rest}
    >
      {children}
    </MuiCard>
  );
}

export function CardBody({ style, className, children, ...rest }) {
  return (
    <div className={className} style={{ padding: 16, ...style }} {...rest}>
      {children}
    </div>
  );
}

export function Divider(props) {
  return <MuiDivider {...props} />;
}

export function Badge({ content, color, children }) {
  const badgeColor =
    color === 'danger' ? { backgroundColor: '#dc2626', color: '#fff' } : undefined;
  return (
    <MuiBadge
      badgeContent={content}
      color={color === 'danger' ? 'error' : 'primary'}
      sx={badgeColor ? { '& .MuiBadge-badge': badgeColor } : undefined}
      overlap="circular"
    >
      {children}
    </MuiBadge>
  );
}

export function Chip({ size = 'md', color, variant, className, children, ...rest }) {
  const c = color || 'default';
  const muiColor = c === 'default' ? undefined : colorToMUIColor(c);
  return (
    <MuiChip
      className={className}
      label={children}
      size={size === 'sm' ? 'small' : 'medium'}
      color={muiColor}
      variant="filled"
      {...rest}
    />
  );
}

export function Avatar({ size = 'sm', name, ...rest }) {
  const px = size === 'sm' ? 28 : 36;
  return <MuiAvatar sx={{ width: px, height: px }} {...rest}>{name?.[0] || '?'}</MuiAvatar>;
}

export function Input({ startContent, placeholder, value, onChange, onFocus, type, className, maxLength, InputProps: inputPropsRest, ...rest }) {
  return (
    <TextField
      className={className}
      size="small"
      fullWidth
      placeholder={placeholder}
      value={value ?? ''}
      type={type || 'text'}
      onFocus={onFocus}
      onChange={(e) => {
        if (onChange) onChange(e);
      }}
      InputProps={{
        ...(inputPropsRest || {}),
        startAdornment: startContent ? (
          <InputAdornment position="start">{startContent}</InputAdornment>
        ) : inputPropsRest?.startAdornment,
        inputProps: {
          ...((inputPropsRest && inputPropsRest.inputProps) || {}),
          ...(maxLength ? { maxLength } : {})
        }
      }}
      {...rest}
    />
  );
}

export function Dropdown({ isOpen, onOpenChange, children, ...rest }) {
  const triggerChild = React.Children.toArray(children).find((c) => c?.type === DropdownTrigger);
  const menuChild = React.Children.toArray(children).find((c) => c?.type === DropdownMenu);
  const [anchorEl, setAnchorEl] = useState(null);

  useEffect(() => {
    if (isOpen === false) setAnchorEl(null);
  }, [isOpen]);

  const open = Boolean(anchorEl) && (isOpen === undefined ? true : Boolean(isOpen));

  const close = () => {
    setAnchorEl(null);
    if (onOpenChange) onOpenChange(false);
  };

  const trigger = triggerChild?.props?.children;
  const items = menuChild?.props?.children;
  const menuAriaLabel = menuChild?.props?.['aria-label'];

  return (
    <DropdownCtx.Provider value={{ close }}>
      <>
        {trigger &&
          React.isValidElement(trigger) &&
          React.cloneElement(trigger, {
            onClick: (e) => {
              setAnchorEl(e.currentTarget);
              if (onOpenChange) onOpenChange(true);
              if (trigger.props?.onClick) trigger.props.onClick(e);
            }
          })}
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={close}
          MenuListProps={{ 'aria-label': menuAriaLabel }}
        >
          {items}
        </Menu>
      </>
    </DropdownCtx.Provider>
  );
}

export function DropdownTrigger({ children }) {
  return children ? children : null;
}

export function DropdownMenu({ children }) {
  return <>{children}</>;
}

export function DropdownItem({ children, onPress, color, className }) {
  const { close } = useContext(DropdownCtx);
  return (
    <MenuItem
      className={className}
      onClick={() => {
        if (onPress) onPress();
        close();
      }}
      sx={color === 'danger' ? { color: '#dc2626' } : undefined}
    >
      {children}
    </MenuItem>
  );
}

