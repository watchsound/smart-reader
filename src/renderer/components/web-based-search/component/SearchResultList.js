/* eslint-disable react/function-component-definition */
import React from 'react';
import PropTypes from 'prop-types';
import { Typography, Box, Link, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const SearchResultList = ({ data }) => {
  const navigate = useNavigate();

  return (
    <Box sx={{ padding: 1 }}>
      {data.map((item, index) => (
        <Paper key={index} sx={{ padding: 1, marginBottom: 1 }} elevation={1}>
          <Typography
            variant="subtitle4"
            color="text.secondary"
            sx={{ marginBottom: 1 }}
          >
            {item.url || ''}
          </Typography>
          <Link
            href={item.url || ''}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            color="primary"
            onClick={(e) => {
              e.preventDefault();
              navigate(`/browser/${item.url || ''}`);
            }}
          >
            <Typography
              variant="h10"
              component="div"
              sx={{ cursor: 'pointer' }}
            >
              {item.title}
            </Typography>
          </Link>
          {item.snippet && (
            <Typography
              variant="body8"
              color="text.secondary"
              sx={{ marginTop: 1 }}
            >
              {item.snippet}
            </Typography>
          )}
        </Paper>
      ))}
    </Box>
  );
};

SearchResultList.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      url: PropTypes.string.isRequired,
      snippet: PropTypes.string,
    }),
  ).isRequired,
};

export default SearchResultList;
