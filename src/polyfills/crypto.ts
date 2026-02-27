export const randomUUID = (): string => {
	return '00000000-0000-0000-0000-000000000000'.replace(/0/g, () => {
		return Math.floor(Math.random() * 16).toString(16);
	});
};
