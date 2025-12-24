interface IUser {
    sub: string
    email: string,
    iat: number,
    exp: number
    teamId: string,
    role: string
}


export { IUser }