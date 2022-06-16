const filterObject = (rawObject, filterKeys) => {
    return filterKeys.reduce((filteredObject, key) => {
        if(rawObject.hasOwnProperty(key))
            filteredObject[key] = rawObject[key];
        return filteredObject;
    }, {});
};

export default filterObject;
