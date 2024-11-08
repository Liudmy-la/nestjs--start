import { ForbiddenException, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "src/prisma/prisma.service";
import { AuthDto } from "./dto";
import  * as argon from 'argon2';
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwt: JwtService,
        private config: ConfigService,
    ) {}

    async signup(dto: AuthDto) {
        const hash = await argon.hash(dto.password);

        try {
            const user = await this.prisma.user.create({
                data: {
                    email: dto.email,
                    hash,
                },
            });

            return this.signToken(user.id, user.email);
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                if (error.code === 'P2002') throw new ForbiddenException('Credentials taken');
            }
            throw error;
        }
    }

    async signin(dto: AuthDto) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { email: dto.email }
            });

            if(!user) throw new ForbiddenException('Credentials incorrect');
            
            const passordMatches = await argon.verify(
                user.hash,
                dto.password,
            );

            if(!passordMatches) throw new ForbiddenException('Credentials incorrect');
     
            return this.signToken(user.id, user.email);
        } catch (error) {
            throw error;
        }
    }

    async signToken(
        userId: number,
        email: string,
    ): Promise<{ access_token: string }> {
        const payload = {
            sub: userId,
            email
        }
        const secret = this.config.get('JWT_SECRET');

        const token = await this.jwt.signAsync(payload, { 
            expiresIn: '15m',
            secret,
        })
        return {
            access_token: token
        }
    }
}