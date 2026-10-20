package com.lecturelens.common;

public class InsufficientSourceMaterialException extends IllegalArgumentException {
    public InsufficientSourceMaterialException(String message) {
        super(message);
    }
}
