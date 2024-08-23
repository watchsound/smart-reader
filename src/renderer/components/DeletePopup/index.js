/* eslint-disable react/prop-types */
import React from 'react';
import toast from 'react-hot-toast';

function DeletePopup({
  mode,
  name,
  title,
  description,
  handleDeletePopup,
  handleDeleteOperation,
}) {
  function handleCancel() {
    handleDeletePopup(false);
  }

  function handleConfirm() {
    handleDeletePopup(false);
    handleDeleteOperation();
    toast.success('Delete Successfully');
  }

  return (
    <div className="delete-dialog-container">
      <div className="delete-dialog-title">
        <span>{title}</span>
      </div>

      <div className="delete-dialog-book">
        <div className="delete-dialog-book-title">{name}</div>
      </div>

      <div className="delete-dialog-other-option">
        <span>{description}</span>
      </div>

      <div className="delete-dialog-cancel" onClick={handleCancel}>
        <span>Cancel</span>
      </div>

      <div className="delete-dialog-confirm" onClick={handleConfirm}>
        <span>Delete</span>
      </div>
    </div>
  );
}

export default DeletePopup;
